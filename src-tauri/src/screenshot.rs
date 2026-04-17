use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicU32, Ordering},
    Mutex,
};
use std::time::Instant;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder,
};
use xcap::Monitor;

/// 屏幕上单个窗口的信息（逻辑像素坐标）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowInfo {
    pub title: String,
    pub app_name: String,
    /// 逻辑像素 x 坐标（相对于所在显示器左上角）
    pub x: f64,
    /// 逻辑像素 y 坐标（相对于所在显示器左上角）
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// 获取当前屏幕上所有可见窗口的位置和大小（macOS 实现，纯 FFI）
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn get_window_list(monitor_id: u32) -> Result<Vec<WindowInfo>, String> {
    use std::ffi::{c_void, CStr};
    use std::os::raw::{c_char, c_int};

    // ── 原始 CF/CG 类型别名 ──────────────────────────────────────────────
    type CFTypeRef = *const c_void;
    type CFArrayRef = *const c_void;
    type CFDictionaryRef = *const c_void;
    type CFStringRef = *const c_void;
    type CFNumberRef = *const c_void;
    type CFIndex = isize;
    type CGWindowID = u32;
    type CGWindowListOption = u32;

    const K_CG_WINDOW_LIST_OPTION_ON_SCREEN_ONLY: CGWindowListOption = 1 << 0;
    const K_CG_NULL_WINDOW_ID: CGWindowID = 0;
    const K_CF_NUMBER_FLOAT64_TYPE: c_int = 13;
    const K_CF_NUMBER_S_INT32_TYPE: c_int = 3;

    extern "C" {
        fn CGWindowListCopyWindowInfo(
            option: CGWindowListOption,
            relative_to_window: CGWindowID,
        ) -> CFArrayRef;

        fn CFArrayGetCount(array: CFArrayRef) -> CFIndex;
        fn CFArrayGetValueAtIndex(array: CFArrayRef, idx: CFIndex) -> CFTypeRef;

        fn CFDictionaryGetValue(dict: CFDictionaryRef, key: CFStringRef) -> CFTypeRef;

        fn CFStringCreateWithCString(
            alloc: *const c_void,
            c_str: *const c_char,
            encoding: u32,
        ) -> CFStringRef;
        fn CFStringGetCString(
            the_string: CFStringRef,
            buffer: *mut c_char,
            buffer_size: CFIndex,
            encoding: u32,
        ) -> bool;
        fn CFStringGetLength(the_string: CFStringRef) -> CFIndex;

        fn CFNumberGetValue(number: CFNumberRef, the_type: c_int, value_ptr: *mut c_void) -> bool;

        fn CFRelease(cf: CFTypeRef);
    }

    // UTF-8 encoding constant
    const K_CF_STRING_ENCODING_UTF8: u32 = 0x08000100;

    // 辅助：从 C 字符串字面量创建 CFStringRef（调用方负责 CFRelease）
    unsafe fn make_cf_string(s: &str) -> CFStringRef {
        let c = std::ffi::CString::new(s).unwrap();
        CFStringCreateWithCString(std::ptr::null(), c.as_ptr(), K_CF_STRING_ENCODING_UTF8)
    }

    // 辅助：从 CFStringRef 读取 Rust String
    unsafe fn cf_string_to_rust(cf: CFStringRef) -> Option<String> {
        if cf.is_null() {
            return None;
        }
        let len = CFStringGetLength(cf);
        let buf_size = len * 4 + 1; // UTF-8 最多 4 字节/字符
        let mut buf: Vec<c_char> = vec![0; buf_size as usize];
        if CFStringGetCString(cf, buf.as_mut_ptr(), buf_size, K_CF_STRING_ENCODING_UTF8) {
            let cstr = CStr::from_ptr(buf.as_ptr());
            Some(cstr.to_string_lossy().into_owned())
        } else {
            None
        }
    }

    // 辅助：从 CFDictionary 中读取 f64 数值
    unsafe fn dict_get_f64(dict: CFDictionaryRef, key: &str) -> Option<f64> {
        let k = make_cf_string(key);
        let val = CFDictionaryGetValue(dict, k);
        CFRelease(k);
        if val.is_null() {
            return None;
        }
        let mut out: f64 = 0.0;
        if CFNumberGetValue(
            val,
            K_CF_NUMBER_FLOAT64_TYPE,
            &mut out as *mut f64 as *mut c_void,
        ) {
            Some(out)
        } else {
            None
        }
    }

    // 辅助：从 CFDictionary 中读取 i32 数值
    unsafe fn dict_get_i32(dict: CFDictionaryRef, key: &str) -> Option<i32> {
        let k = make_cf_string(key);
        let val = CFDictionaryGetValue(dict, k);
        CFRelease(k);
        if val.is_null() {
            return None;
        }
        let mut out: i32 = 0;
        if CFNumberGetValue(
            val,
            K_CF_NUMBER_S_INT32_TYPE,
            &mut out as *mut i32 as *mut c_void,
        ) {
            Some(out)
        } else {
            None
        }
    }

    // 辅助：从 CFDictionary 中读取 CFString 字段
    unsafe fn dict_get_string(dict: CFDictionaryRef, key: &str) -> String {
        let k = make_cf_string(key);
        let val = CFDictionaryGetValue(dict, k);
        CFRelease(k);
        if val.is_null() {
            return String::new();
        }
        cf_string_to_rust(val).unwrap_or_default()
    }

    // ── 获取目标显示器边界（逻辑像素） ──────────────────────────────────
    // 使用 xcap 获取显示器信息，与 show_screenshot_window 保持一致
    let monitors = Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;
    let target_monitor = monitors
        .iter()
        .find(|m| m.id().map(|id| id == monitor_id).unwrap_or(false))
        .ok_or_else(|| format!("显示器 ID {} 不存在", monitor_id))?;

    let mx = target_monitor.x().map_err(|e| format!("获取显示器X坐标失败: {}", e))? as f64;
    let my = target_monitor.y().map_err(|e| format!("获取显示器Y坐标失败: {}", e))? as f64;
    let m_width = target_monitor.width().map_err(|e| format!("获取显示器宽度失败: {}", e))? as f64;
    let m_height = target_monitor.height().map_err(|e| format!("获取显示器高度失败: {}", e))? as f64;

    // ── 调用 CGWindowListCopyWindowInfo ──────────────────────────────────
    let array = unsafe {
        CGWindowListCopyWindowInfo(K_CG_WINDOW_LIST_OPTION_ON_SCREEN_ONLY, K_CG_NULL_WINDOW_ID)
    };
    if array.is_null() {
        return Ok(vec![]);
    }

    let count = unsafe { CFArrayGetCount(array) };
    let mut windows: Vec<WindowInfo> = Vec::new();

    for i in 0..count {
        let item = unsafe { CFArrayGetValueAtIndex(array, i) };
        if item.is_null() {
            continue;
        }
        let dict = item as CFDictionaryRef;

        // 只处理 layer == 0 的普通应用窗口
        let layer = unsafe { dict_get_i32(dict, "kCGWindowLayer").unwrap_or(1) };
        if layer != 0 {
            continue;
        }

        // 获取 kCGWindowBounds（子字典）
        let bounds_key = unsafe { make_cf_string("kCGWindowBounds") };
        let bounds_val = unsafe { CFDictionaryGetValue(dict, bounds_key) };
        unsafe { CFRelease(bounds_key) };
        if bounds_val.is_null() {
            continue;
        }
        let bounds_dict = bounds_val as CFDictionaryRef;

        let win_x = unsafe { dict_get_f64(bounds_dict, "X").unwrap_or(0.0) };
        let win_y = unsafe { dict_get_f64(bounds_dict, "Y").unwrap_or(0.0) };
        let win_w = unsafe { dict_get_f64(bounds_dict, "Width").unwrap_or(0.0) };
        let win_h = unsafe { dict_get_f64(bounds_dict, "Height").unwrap_or(0.0) };

        // 过滤太小的窗口
        if win_w < 50.0 || win_h < 50.0 {
            continue;
        }

        // 转换为相对于目标显示器的坐标
        let rel_x = win_x - mx;
        let rel_y = win_y - my;

        // 只保留在目标显示器范围内的窗口
        if rel_x + win_w <= 0.0
            || rel_y + win_h <= 0.0
            || rel_x >= m_width
            || rel_y >= m_height
        {
            continue;
        }

        // 裁剪到显示器范围内
        let clipped_x = rel_x.max(0.0);
        let clipped_y = rel_y.max(0.0);
        let clipped_w = (rel_x + win_w).min(m_width) - clipped_x;
        let clipped_h = (rel_y + win_h).min(m_height) - clipped_y;

        if clipped_w < 10.0 || clipped_h < 10.0 {
            continue;
        }

        let app_name = unsafe { dict_get_string(dict, "kCGWindowOwnerName") };
        let title = unsafe { dict_get_string(dict, "kCGWindowName") };

        windows.push(WindowInfo {
            title,
            app_name,
            x: clipped_x,
            y: clipped_y,
            width: clipped_w,
            height: clipped_h,
        });
    }

    unsafe { CFRelease(array) };

    Ok(windows)
}

/// 非 macOS 平台的占位实现
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn get_window_list(_monitor_id: u32) -> Result<Vec<WindowInfo>, String> {
    Ok(vec![])
}

/// macOS Vision framework OCR 实现
/// 返回 JSON 字符串，格式为：
/// [{"text":"...", "x":0.1, "y":0.1, "w":0.3, "h":0.05}, ...]
/// 坐标为归一化值（0~1），原点在图片左上角（已从 Vision 的左下角坐标系转换）
#[cfg(target_os = "macos")]
fn ocr_with_vision(png_bytes: &[u8]) -> Result<String, String> {
    // 将 PNG bytes 写入临时文件，然后用 Vision 处理
    let tmp_path = format!(
        "/tmp/wecut_ocr_{}.png",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    std::fs::write(&tmp_path, png_bytes).map_err(|e| format!("写入临时文件失败: {}", e))?;

    // Swift 脚本：输出每个文字块的文字和边界框（归一化坐标，转换为左上角原点）
    let output = std::process::Command::new("swift")
        .arg("-e")
        .arg(format!(
            r#"
import Vision
import Foundation

let url = URL(fileURLWithPath: "{}")
guard let cgImageSource = CGImageSourceCreateWithURL(url as CFURL, nil),
      let cgImage = CGImageSourceCreateImageAtIndex(cgImageSource, 0, nil) else {{
    print("[]")
    exit(0)
}}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US", "ja-JP", "ko-KR"]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try? handler.perform([request])

var items: [String] = []
if let results = request.results {{
    for obs in results {{
        guard let candidate = obs.topCandidates(1).first else {{ continue }}
        let text = candidate.string
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
        // Vision 坐标系：原点在左下角，y 轴向上
        // 转换为左上角原点：topY = 1 - (bb.origin.y + bb.size.height)
        let bb = obs.boundingBox
        let x = bb.origin.x
        let y = 1.0 - (bb.origin.y + bb.size.height)
        let w = bb.size.width
        let h = bb.size.height
        items.append("{{\"text\":\"\(text)\",\"x\":\(x),\"y\":\(y),\"w\":\(w),\"h\":\(h)}}")
    }}
}}
print("[" + items.joined(separator: ",") + "]")
"#,
            tmp_path
        ))
        .output()
        .map_err(|e| format!("执行 Swift OCR 失败: {}", e))?;

    // 清理临时文件
    let _ = std::fs::remove_file(&tmp_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("OCR 执行失败: {}", stderr));
    }

    let json = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(json)
}

/// 非 macOS 平台的 OCR 占位实现
#[cfg(not(target_os = "macos"))]
fn ocr_with_vision(_png_bytes: &[u8]) -> Result<String, String> {
    Err("OCR 功能目前仅支持 macOS".to_string())
}

/// 全局 pin 窗口计数器，用于生成唯一 label
static PIN_WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);

#[derive(Serialize, Deserialize, Clone)]
pub struct PinData {
    pub image_data_url: String,
    pub w: f64,
    pub h: f64,
    pub label: String,
    /// 截图时对应的显示器 ID（仅截图窗口使用，pin 窗口为 0）
    #[serde(default)]
    pub monitor_id: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ScreenshotPreviewData {
    pub preview_image_data_url: String,
    pub selection_source: String,
    pub w: f64,
    pub h: f64,
    pub logical_w: f64,
    pub logical_h: f64,
    pub label: String,
    #[serde(default)]
    pub monitor_id: u32,
}

#[derive(Clone)]
struct ScreenshotOriginalFrame {
    rgba: Vec<u8>,
    width: u32,
    height: u32,
}

struct ScreenshotSession {
    preview: Option<ScreenshotPreviewData>,
    original: ScreenshotOriginalFrame,
    logical_w: f64,
    logical_h: f64,
}

/// 截图会话存储（label -> session）。
///
/// 架构不变量（方案 A）：
/// 1) preview 路径只服务"快选区"，不能定义最终导出质量；
/// 2) 最终导出必须来自 Rust 持有的 original 全屏帧裁切，不能依赖 preview 编码格式。
static SCREENSHOT_SESSION_STORE: Mutex<Option<HashMap<String, ScreenshotSession>>> =
    Mutex::new(None);

/// 全局 pin 数据存储：label -> PinData
/// 前端加载完成后主动 invoke get_pin_data 获取，避免 emit 时序问题
static PIN_DATA_STORE: Mutex<Option<HashMap<String, PinData>>> = Mutex::new(None);

fn screenshot_store_insert(label: String, session: ScreenshotSession) {
    let mut guard = SCREENSHOT_SESSION_STORE.lock().unwrap();
    let map = guard.get_or_insert_with(HashMap::new);
    map.insert(label, session);
}

fn screenshot_store_take_preview(label: &str) -> Option<ScreenshotPreviewData> {
    let mut guard = SCREENSHOT_SESSION_STORE.lock().unwrap();
    let session = guard.as_mut()?.get_mut(label)?;
    session.preview.take()
}

fn screenshot_store_remove(label: &str) {
    let mut guard = SCREENSHOT_SESSION_STORE.lock().unwrap();
    if let Some(map) = guard.as_mut() {
        map.remove(label);
    }
}

fn pin_store_insert(label: String, data: PinData) {
    let mut guard = PIN_DATA_STORE.lock().unwrap();
    let map = guard.get_or_insert_with(HashMap::new);
    map.insert(label, data);
}

fn pin_store_remove(label: &str) -> Option<PinData> {
    let mut guard = PIN_DATA_STORE.lock().unwrap();
    guard.as_mut()?.remove(label)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    #[serde(rename = "scaleFactor")]
    pub scale_factor: f32,
    #[serde(rename = "isPrimary")]
    pub is_primary: bool,
}

/// 获取所有显示器信息
#[tauri::command]
pub async fn get_monitors() -> Result<Vec<MonitorInfo>, String> {
    let monitors = Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;

    let mut infos = Vec::new();
    for m in monitors.iter() {
        infos.push(MonitorInfo {
            id: m.id().map_err(|e| format!("获取显示器ID失败: {}", e))?,
            name: m.name().map_err(|e| format!("获取显示器名称失败: {}", e))?,
            x: m.x().map_err(|e| format!("获取显示器X坐标失败: {}", e))?,
            y: m.y().map_err(|e| format!("获取显示器Y坐标失败: {}", e))?,
            width: m
                .width()
                .map_err(|e| format!("获取显示器宽度失败: {}", e))?,
            height: m
                .height()
                .map_err(|e| format!("获取显示器高度失败: {}", e))?,
            scale_factor: m
                .scale_factor()
                .map_err(|e| format!("获取显示器缩放比例失败: {}", e))?,
            is_primary: m
                .is_primary()
                .map_err(|e| format!("获取显示器主屏状态失败: {}", e))?,
        });
    }

    Ok(infos)
}

/// 根据桌面点位获取显示器 ID，找不到时回退到主显示器 ID 或第一个显示器的 ID
#[tauri::command]
pub async fn get_monitor_id_from_point(x: i32, y: i32) -> Result<u32, String> {
    let monitors = Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;

    if monitors.is_empty() {
        return Ok(0);
    }

    if let Ok(target_monitor) = Monitor::from_point(x, y) {
        let target_id = target_monitor
            .id()
            .map_err(|e| format!("获取显示器ID失败: {}", e))?;
        return Ok(target_id);
    }

    // 兼容前端传入"物理像素坐标"的情况：
    // xcap monitor 的 x/y/width/height 是逻辑坐标，乘以 scale_factor 后按物理坐标匹配一次。
    for monitor in monitors.iter() {
        let mx = monitor.x().unwrap_or_default() as f64;
        let my = monitor.y().unwrap_or_default() as f64;
        let mw = monitor.width().unwrap_or_default() as f64;
        let mh = monitor.height().unwrap_or_default() as f64;
        let scale = monitor.scale_factor().unwrap_or(1.0) as f64;

        let px = x as f64;
        let py = y as f64;
        let sx = mx * scale;
        let sy = my * scale;
        let sw = mw * scale;
        let sh = mh * scale;
        let hit = px >= sx && px < sx + sw && py >= sy && py < sy + sh;
        if hit {
            let id = monitor.id().map_err(|e| format!("获取显示器ID失败: {}", e))?;
            return Ok(id);
        }
    }

    // 回退到主显示器
    if let Some(primary) = monitors.iter().find(|m| m.is_primary().unwrap_or(false)) {
        let id = primary.id().map_err(|e| format!("获取显示器ID失败: {}", e))?;
        return Ok(id);
    }

    // 最后回退到第一个显示器
    monitors
        .first()
        .and_then(|m| m.id().ok())
        .ok_or_else(|| "无法获取任何显示器ID".to_string())
}

fn encode_png_data_url_from_rgba(
    rgba: &[u8],
    width: u32,
    height: u32,
    compression: image::codecs::png::CompressionType,
    filter: image::codecs::png::FilterType,
) -> Result<String, String> {
    use image::ImageEncoder;
    let mut bytes: Vec<u8> = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new_with_quality(&mut bytes, compression, filter);
    encoder
        .write_image(rgba, width, height, image::ColorType::Rgba8.into())
        .map_err(|e| format!("PNG 编码失败: {}", e))?;
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(&bytes)))
}

fn encode_jpeg_data_url_from_rgba(rgba: &[u8], width: u32, height: u32) -> Result<String, String> {
    let rgb_raw: Vec<u8> = rgba.chunks_exact(4).flat_map(|p| [p[0], p[1], p[2]]).collect();
    let mut bytes: Vec<u8> = Vec::new();
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut bytes, 85);
    encoder
        .encode(&rgb_raw, width, height, image::ColorType::Rgb8.into())
        .map_err(|e| format!("JPEG 编码失败: {}", e))?;
    Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(&bytes)))
}

fn capture_monitor_original_frame_by_id(monitor_id: u32) -> Result<ScreenshotOriginalFrame, String> {
    let monitors = Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;
    let monitor = monitors
        .iter()
        .find(|m| m.id().map(|id| id == monitor_id).unwrap_or(false))
        .ok_or_else(|| format!("显示器 ID {} 不存在", monitor_id))?;
    let image = monitor
        .capture_image()
        .map_err(|e| format!("截图失败: {}", e))?;
    Ok(ScreenshotOriginalFrame {
        rgba: image.as_raw().clone(),
        width: image.width(),
        height: image.height(),
    })
}

fn capture_monitor_to_png_data_url_by_id(monitor_id: u32) -> Result<String, String> {
    let started_at = Instant::now();
    let capture_started_at = Instant::now();
    let frame = capture_monitor_original_frame_by_id(monitor_id)?;
    let capture_elapsed_ms = capture_started_at.elapsed().as_millis();
    let encode_started_at = Instant::now();
    let data_url = encode_png_data_url_from_rgba(
        &frame.rgba,
        frame.width,
        frame.height,
        image::codecs::png::CompressionType::Fast,
        image::codecs::png::FilterType::Adaptive,
    )?;
    let encode_elapsed_ms = encode_started_at.elapsed().as_millis();

    log::info!(
        "[screenshot][rust] capture_done monitor_id={} size={}x{} capture_ms={} encode_ms={} total_ms={} data_url_len={}",
        monitor_id,
        frame.width,
        frame.height,
        capture_elapsed_ms,
        encode_elapsed_ms,
        started_at.elapsed().as_millis(),
        data_url.len()
    );

    Ok(data_url)
}

/// 截取指定显示器的屏幕，返回 PNG base64 字符串
#[tauri::command]
pub async fn capture_screen(monitor_id: u32) -> Result<String, String> {
    capture_monitor_to_png_data_url_by_id(monitor_id)
}

/// 使用 macOS 原生 API (Core Graphics) 截取指定显示器，返回 JPEG base64
#[cfg(target_os = "macos")]
fn capture_screen_native_jpeg(display_id: u32, quality: f64) -> Result<Vec<u8>, String> {
    use core_foundation::base::TCFType;
    use core_foundation::data::CFDataRef;
    use core_foundation::dictionary::CFDictionary;
    use core_foundation::number::CFNumber;
    use core_foundation::string::CFString;
    use core_graphics::display::CGDisplay;
    use foreign_types_shared::ForeignType;
    use std::ffi::c_void;

    let display = CGDisplay::new(display_id);
    let cg_image = display
        .image()
        .ok_or_else(|| "CGDisplayCreateImage 返回 null".to_string())?;

    let jpeg_data = unsafe {
        let mutable_data_ref: core_foundation::data::CFDataRef = {
            extern "C" {
                fn CFDataCreateMutable(allocator: *const c_void, capacity: isize) -> CFDataRef;
            }
            CFDataCreateMutable(std::ptr::null(), 0)
        };

        let uti = CFString::new("public.jpeg");

        extern "C" {
            fn CGImageDestinationCreateWithData(
                data: CFDataRef,
                type_: core_foundation::string::CFStringRef,
                count: usize,
                options: *const c_void,
            ) -> *mut c_void;

            fn CGImageDestinationAddImage(
                dest: *mut c_void,
                image: *const c_void,
                properties: *const c_void,
            );

            fn CGImageDestinationFinalize(dest: *mut c_void) -> bool;

            fn CFRelease(cf: *const c_void);

            fn CFDataGetLength(data: CFDataRef) -> isize;
            fn CFDataGetBytePtr(data: CFDataRef) -> *const u8;
        }

        let dest = CGImageDestinationCreateWithData(
            mutable_data_ref,
            uti.as_concrete_TypeRef(),
            1,
            std::ptr::null(),
        );

        if dest.is_null() {
            CFRelease(mutable_data_ref as *const c_void);
            return Err("CGImageDestinationCreateWithData 失败".to_string());
        }

        let quality_num = CFNumber::from(quality);
        let compression_key = CFString::new("kCGImageDestinationLossyCompressionQuality");
        let props = CFDictionary::from_CFType_pairs(&[(
            compression_key.as_CFType(),
            quality_num.as_CFType(),
        )]);

        CGImageDestinationAddImage(
            dest,
            cg_image.as_ptr() as *const c_void,
            props.as_concrete_TypeRef() as *const c_void,
        );

        let ok = CGImageDestinationFinalize(dest);
        CFRelease(dest);

        if !ok {
            CFRelease(mutable_data_ref as *const c_void);
            return Err("CGImageDestinationFinalize 失败".to_string());
        }

        let len = CFDataGetLength(mutable_data_ref) as usize;
        let ptr = CFDataGetBytePtr(mutable_data_ref);
        let bytes = std::slice::from_raw_parts(ptr, len).to_vec();
        CFRelease(mutable_data_ref as *const c_void);
        bytes
    };

    Ok(jpeg_data)
}

fn capture_preview_data_url_by_id(
    monitor_id: u32,
    original: &ScreenshotOriginalFrame,
) -> Result<(String, String), String> {
    #[cfg(target_os = "macos")]
    {
        // monitor_id 就是 CGDirectDisplayID，直接使用
        if let Ok(bytes) = capture_screen_native_jpeg(monitor_id, 0.85) {
            return Ok((
                format!("data:image/jpeg;base64,{}", STANDARD.encode(&bytes)),
                "macos-native-fast-preview".to_string(),
            ));
        }
    }

    let data_url = encode_jpeg_data_url_from_rgba(&original.rgba, original.width, original.height)?;
    Ok((data_url, "generic-fast-preview".to_string()))
}

fn resolve_crop_rect(
    original_w: u32,
    original_h: u32,
    logical_w: f64,
    logical_h: f64,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> (u32, u32, u32, u32) {
    let lw = logical_w.max(1.0);
    let lh = logical_h.max(1.0);
    let scale_x = original_w as f64 / lw;
    let scale_y = original_h as f64 / lh;

    let mut px = (x.max(0.0) * scale_x).floor() as i64;
    let mut py = (y.max(0.0) * scale_y).floor() as i64;
    let mut pw = (w.max(1.0) * scale_x).round() as i64;
    let mut ph = (h.max(1.0) * scale_y).round() as i64;

    if px >= original_w as i64 {
        px = original_w.saturating_sub(1) as i64;
    }
    if py >= original_h as i64 {
        py = original_h.saturating_sub(1) as i64;
    }
    if px < 0 {
        px = 0;
    }
    if py < 0 {
        py = 0;
    }

    let max_w = (original_w as i64 - px).max(1);
    let max_h = (original_h as i64 - py).max(1);
    if pw <= 0 {
        pw = 1;
    }
    if ph <= 0 {
        ph = 1;
    }
    if pw > max_w {
        pw = max_w;
    }
    if ph > max_h {
        ph = max_h;
    }

    (px as u32, py as u32, pw as u32, ph as u32)
}

fn crop_rgba_pixels(
    frame: &ScreenshotOriginalFrame,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
) -> Result<Vec<u8>, String> {
    let row_bytes = frame.width as usize * 4;
    let crop_row_bytes = w as usize * 4;
    let mut out = vec![0_u8; crop_row_bytes * h as usize];

    for row in 0..h as usize {
        let src_row = y as usize + row;
        let dst_row = row;
        let src_start = src_row
            .checked_mul(row_bytes)
            .and_then(|v| v.checked_add(x as usize * 4))
            .ok_or_else(|| "裁切索引溢出".to_string())?;
        let src_end = src_start
            .checked_add(crop_row_bytes)
            .ok_or_else(|| "裁切索引溢出".to_string())?;
        if src_end > frame.rgba.len() {
            return Err("裁切范围超出原始截图边界".to_string());
        }
        let dst_start = dst_row
            .checked_mul(crop_row_bytes)
            .ok_or_else(|| "裁切索引溢出".to_string())?;
        let dst_end = dst_start
            .checked_add(crop_row_bytes)
            .ok_or_else(|| "裁切索引溢出".to_string())?;
        out[dst_start..dst_end].copy_from_slice(&frame.rgba[src_start..src_end]);
    }

    Ok(out)
}

/// 全局截图窗口计数器，用于生成唯一 label（仅在预创建窗口不可用时使用）
static SCREENSHOT_WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);

/// 预创建截图窗口的固定 label
const PREBUILT_SCREENSHOT_LABEL: &str = "screenshot";

/// 截图并显示截图窗口。
/// 优先复用预创建的 "screenshot" 窗口（隐藏状态），避免每次重新创建 WebView 的开销。
/// 若预创建窗口不存在，则动态创建新窗口。
/// 先截图，再显示窗口，避免截到截图窗口自身。
/// 返回窗口的 label。
#[tauri::command]
pub async fn show_screenshot_window(
    app: AppHandle,
    monitor_id: u32,
    request_id: Option<String>,
) -> Result<String, String> {
    let req = request_id.as_deref().unwrap_or("-");
    let total_started_at = Instant::now();
    log::info!(
        "[screenshot][rust][{}] show_window:start monitor_id={}",
        req,
        monitor_id
    );

    let monitor_stage_started_at = Instant::now();
    let monitors = Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;

    // 根据 monitor_id 查找显示器
    let monitor = monitors
        .iter()
        .find(|m| m.id().map(|id| id == monitor_id).unwrap_or(false))
        .ok_or_else(|| format!("显示器 ID {} 不存在", monitor_id))?;

    let x = monitor
        .x()
        .map_err(|e| format!("获取显示器X坐标失败: {}", e))?;
    let y = monitor
        .y()
        .map_err(|e| format!("获取显示器Y坐标失败: {}", e))?;
    let width = monitor
        .width()
        .map_err(|e| format!("获取显示器宽度失败: {}", e))?;
    let height = monitor
        .height()
        .map_err(|e| format!("获取显示器高度失败: {}", e))?;
    let scale_factor = monitor
        .scale_factor()
        .map_err(|e| format!("获取显示器缩放比例失败: {}", e))?;

    // 调试日志：打印显示器信息
    log::info!(
        "[screenshot][rust] monitor_info: id={}, x={}, y={}, width={}, height={}, scale_factor={}",
        monitor_id, x, y, width, height, scale_factor
    );
    let monitor_stage_elapsed_ms = monitor_stage_started_at.elapsed().as_millis();

    let original_capture_started_at = Instant::now();
    let original_frame = capture_monitor_original_frame_by_id(monitor_id)?;
    let original_capture_elapsed_ms = original_capture_started_at.elapsed().as_millis();

    let preview_stage_started_at = Instant::now();
    let (preview_image_data_url, selection_source) =
        capture_preview_data_url_by_id(monitor_id, &original_frame)?;
    let preview_stage_elapsed_ms = preview_stage_started_at.elapsed().as_millis();

    let window_stage_started_at = Instant::now();

    // 尝试复用预创建的 screenshot 窗口
    let (label, window, reused_prebuilt) =
        if let Some(existing) = app.get_webview_window(PREBUILT_SCREENSHOT_LABEL) {
            // 调整窗口位置和大小以覆盖目标显示器
            existing
                .set_position(LogicalPosition::new(x as f64, y as f64))
                .map_err(|e| format!("设置窗口位置失败: {}", e))?;
            existing
                .set_size(LogicalSize::new(width as f64, height as f64))
                .map_err(|e| format!("设置窗口大小失败: {}", e))?;
            (PREBUILT_SCREENSHOT_LABEL.to_string(), existing, true)
        } else {
            // 预创建窗口不存在，动态创建新窗口
            let id = SCREENSHOT_WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst);
            let label = format!("screenshot-{}", id);
            let win = WebviewWindowBuilder::new(
                &app,
                &label,
                WebviewUrl::App("index.html/#/screenshot".into()),
            )
            .position(x as f64, y as f64)
            .inner_size(width as f64, height as f64)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .resizable(true)
            .skip_taskbar(true)
            .accept_first_mouse(true)
            .visible_on_all_workspaces(true)
            .focused(true)
            .build()
            .map_err(|e| format!("创建截图窗口失败: {}", e))?;
            (label, win, false)
        };
    let window_stage_elapsed_ms = window_stage_started_at.elapsed().as_millis();

    // 将截图数据存入全局 store，前端加载完成后主动拉取
    let store_stage_started_at = Instant::now();
    screenshot_store_insert(
        label.clone(),
        ScreenshotSession {
            preview: Some(ScreenshotPreviewData {
                preview_image_data_url,
                selection_source: selection_source.clone(),
                w: width as f64,
                h: height as f64,
                logical_w: width as f64,
                logical_h: height as f64,
                label: label.clone(),
                monitor_id,
            }),
            original: original_frame,
            logical_w: width as f64,
            logical_h: height as f64,
        },
    );
    let store_stage_elapsed_ms = store_stage_started_at.elapsed().as_millis();

    // emit 通知前端截图已就绪（前端已加载完毕可直接收到）
    let emit_stage_started_at = Instant::now();
    let _ = window.emit("screenshot:ready", label.clone());
    let emit_stage_elapsed_ms = emit_stage_started_at.elapsed().as_millis();

    // 显示并聚焦窗口
    let show_stage_started_at = Instant::now();
    window
        .show()
        .map_err(|e| format!("显示截图窗口失败: {}", e))?;
    let show_stage_elapsed_ms = show_stage_started_at.elapsed().as_millis();

    let focus_stage_started_at = Instant::now();
    window
        .set_focus()
        .map_err(|e| format!("聚焦截图窗口失败: {}", e))?;
    let focus_stage_elapsed_ms = focus_stage_started_at.elapsed().as_millis();

    log::info!(
        "[screenshot][rust][{}] show_window:done label={} reused_prebuilt={} monitor_id={}({}x{}@{},{} ) selection_source={} stage_ms={{monitor:{},capture_original:{},preview:{},window:{},store:{},emit:{},show:{},focus:{}}} total_ms={}",
        req,
        label,
        reused_prebuilt,
        monitor_id,
        width,
        height,
        x,
        y,
        selection_source,
        monitor_stage_elapsed_ms,
        original_capture_elapsed_ms,
        preview_stage_elapsed_ms,
        window_stage_elapsed_ms,
        store_stage_elapsed_ms,
        emit_stage_elapsed_ms,
        show_stage_elapsed_ms,
        focus_stage_elapsed_ms,
        total_started_at.elapsed().as_millis()
    );

    Ok(label)
}

/// 隐藏截图窗口。
/// 对于预创建的 "screenshot" 窗口，使用 hide() 保留窗口供下次复用。
/// 对于动态创建的窗口（label 以 "screenshot-" 开头），使用 close() 销毁。
#[tauri::command]
pub async fn hide_screenshot_window(app: AppHandle, label: Option<String>) -> Result<(), String> {
    let lbl = label.unwrap_or_else(|| PREBUILT_SCREENSHOT_LABEL.to_string());
    screenshot_store_remove(&lbl);
    if let Some(window) = app.get_webview_window(&lbl) {
        if lbl == PREBUILT_SCREENSHOT_LABEL {
            // 预创建窗口：隐藏保留，下次复用
            window
                .hide()
                .map_err(|e| format!("隐藏截图窗口失败: {}", e))?;
        } else {
            // 动态创建的窗口：直接关闭
            window
                .close()
                .map_err(|e| format!("关闭截图窗口失败: {}", e))?;
        }
    }
    Ok(())
}

/// 将截图窗口缩小到选区大小并钉在屏幕上（保持置顶，允许用户操作其他窗口）
#[tauri::command]
pub async fn pin_screenshot_window(
    app: AppHandle,
    label: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window
            .set_resizable(true)
            .map_err(|e| format!("设置窗口可调整大小失败: {}", e))?;

        let min_width = 120.0_f64;
        let actual_width = w.max(min_width);

        window
            .set_position(LogicalPosition::new(x, y))
            .map_err(|e| format!("设置窗口位置失败: {}", e))?;

        window
            .set_size(LogicalSize::new(actual_width, h))
            .map_err(|e| format!("设置窗口大小失败: {}", e))?;

        window
            .set_always_on_top(true)
            .map_err(|e| format!("设置置顶失败: {}", e))?;

        window
            .set_resizable(false)
            .map_err(|e| format!("禁止调整大小失败: {}", e))?;
    }
    Ok(())
}

/// 获取截图数据（前端主动拉取，一次性）
#[tauri::command]
pub async fn get_screenshot_data(label: String) -> Result<Option<ScreenshotPreviewData>, String> {
    Ok(screenshot_store_take_preview(&label))
}

/// 从 Rust 持有的原始全屏帧中裁切高质量选区，返回 PNG data URL
#[tauri::command]
pub async fn get_screenshot_crop(
    label: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<String, String> {
    let started_at = Instant::now();

    let (crop_x, crop_y, crop_w, crop_h, crop_bytes) = {
        let guard = SCREENSHOT_SESSION_STORE.lock().unwrap();
        let map = guard
            .as_ref()
            .ok_or_else(|| "截图会话不存在或已清理".to_string())?;
        let session = map
            .get(&label)
            .ok_or_else(|| format!("未找到截图会话: {}", label))?;

        let (crop_x, crop_y, crop_w, crop_h) = resolve_crop_rect(
            session.original.width,
            session.original.height,
            session.logical_w,
            session.logical_h,
            x,
            y,
            w,
            h,
        );
        let crop_bytes = crop_rgba_pixels(&session.original, crop_x, crop_y, crop_w, crop_h)?;
        (crop_x, crop_y, crop_w, crop_h, crop_bytes)
    };

    let encode_started_at = Instant::now();
    let data_url = encode_png_data_url_from_rgba(
        &crop_bytes,
        crop_w,
        crop_h,
        image::codecs::png::CompressionType::Best,
        image::codecs::png::FilterType::Adaptive,
    )?;
    let encode_elapsed_ms = encode_started_at.elapsed().as_millis();

    log::info!(
        "[screenshot][rust] crop:done label={} logical=({},{} {}x{}) crop=({},{} {}x{}) encode_ms={} total_ms={}",
        label,
        x,
        y,
        w,
        h,
        crop_x,
        crop_y,
        crop_w,
        crop_h,
        encode_elapsed_ms,
        started_at.elapsed().as_millis()
    );

    Ok(data_url)
}

/// 动态创建一个独立的 pin 窗口，用于同时显示多张 pin 图片。
/// image_data_url: 已编辑好的截图 data URL（PNG base64）
/// x, y, w, h: 逻辑像素坐标（选区位置和大小）
#[tauri::command]
pub async fn create_pin_window(
    app: AppHandle,
    image_data_url: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<String, String> {
    let id = PIN_WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst);
    let label = format!("pin-{}", id);

    // 先将数据存入全局 store，前端加载完成后主动 invoke get_pin_data 获取
    // 避免 emit 时序问题（webview 可能还未注册监听器）
    pin_store_insert(
        label.clone(),
        PinData {
            image_data_url,
            w,
            h,
            label: label.clone(),
            monitor_id: 0,
        },
    );

    // 窗口最小宽度，确保能容纳操作按钮
    let min_width = 120.0_f64;
    let win_w = w.max(min_width);
    let win_h = h;

    // URL 中携带 label 参数，前端据此 invoke get_pin_data
    let url = format!("index.html/#/pin-viewer?label={}", label);

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title("Pin")
        .inner_size(win_w, win_h)
        .position(x - (win_w - w) / 2.0, y)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .accept_first_mouse(true)
        .visible_on_all_workspaces(true)
        .build()
        .map_err(|e| format!("创建 pin 窗口失败: {}", e))?;

    Ok(label)
}

/// 前端加载完成后主动调用，获取 pin 数据（一次性，取后即删）
#[tauri::command]
pub async fn get_pin_data(label: String) -> Result<Option<PinData>, String> {
    Ok(pin_store_remove(&label))
}

/// 关闭指定 label 的 pin 窗口
#[tauri::command]
pub async fn close_pin_window(app: AppHandle, label: String) -> Result<(), String> {
    // 清理可能残留的数据
    pin_store_remove(&label);
    if let Some(window) = app.get_webview_window(&label) {
        window
            .close()
            .map_err(|e| format!("关闭 pin 窗口失败: {}", e))?;
    }
    Ok(())
}

/// 对图片 data URL 执行 OCR，返回识别到的文字
/// image_data_url: PNG 或 JPEG 的 base64 data URL
#[tauri::command]
pub async fn ocr_image(image_data_url: String) -> Result<String, String> {
    // 解析 data URL，提取 base64 部分
    let base64_part = image_data_url
        .split(',')
        .nth(1)
        .ok_or_else(|| "无效的 data URL 格式".to_string())?;

    let png_bytes = STANDARD
        .decode(base64_part)
        .map_err(|e| format!("base64 解码失败: {}", e))?;

    // 如果是 JPEG，转换为 PNG（Vision 更好地支持 PNG）
    let final_bytes = if image_data_url.starts_with("data:image/jpeg") {
        // 将 JPEG 转换为 PNG
        let img =
            image::load_from_memory(&png_bytes).map_err(|e| format!("加载图片失败: {}", e))?;
        let mut png_buf: Vec<u8> = Vec::new();
        use image::ImageEncoder;
        let encoder = image::codecs::png::PngEncoder::new(&mut png_buf);
        encoder
            .write_image(
                img.as_bytes(),
                img.width(),
                img.height(),
                img.color().into(),
            )
            .map_err(|e| format!("转换为 PNG 失败: {}", e))?;
        png_buf
    } else {
        png_bytes
    };

    ocr_with_vision(&final_bytes)
}
/// macOS: 使用 cocoa 原生 API
#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn copy_image_to_clipboard(image_data_url: String) -> Result<(), String> {
    use cocoa::appkit::NSPasteboard;
    use cocoa::base::{id, nil};
    use cocoa::foundation::{NSArray, NSData, NSString};

    let started_at = std::time::Instant::now();
    log::info!("[clipboard][rust] copy_image:start");

    let base64_part = image_data_url
        .split(',')
        .nth(1)
        .ok_or_else(|| "无效的 data URL 格式".to_string())?;

    let decode_started_at = std::time::Instant::now();
    let image_bytes = STANDARD
        .decode(base64_part)
        .map_err(|e| format!("base64 解码失败: {}", e))?;
    let decode_elapsed_ms = decode_started_at.elapsed().as_millis();

    let write_started_at = std::time::Instant::now();
    unsafe {
        let pasteboard: id = NSPasteboard::generalPasteboard(nil);
        pasteboard.clearContents();

        let ns_data: id = NSData::dataWithBytes_length_(
            nil,
            image_bytes.as_ptr() as *const std::ffi::c_void,
            image_bytes.len() as u64,
        );

        let ns_type = NSString::alloc(nil).init_str("public.png");
        let types = NSArray::arrayWithObject(nil, ns_type);
        pasteboard.declareTypes_owner(types, nil);

        let result = pasteboard.setData_forType(ns_data, ns_type);
        if !result {
            return Err("写入剪贴板失败".to_string());
        }
    }
    let write_elapsed_ms = write_started_at.elapsed().as_millis();

    let total_elapsed_ms = started_at.elapsed().as_millis();
    log::info!(
        "[clipboard][rust] copy_image:done decode_ms={} write_ms={} total_ms={}",
        decode_elapsed_ms,
        write_elapsed_ms,
        total_elapsed_ms
    );

    Ok(())
}

/// Windows: 使用 Win32 API
#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn copy_image_to_clipboard(image_data_url: String) -> Result<(), String> {
    use windows::Win32::Foundation::{HGLOBAL, HWND};
    use windows::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData};
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE, GMEM_ZEROINIT};

    let started_at = std::time::Instant::now();
    log::info!("[clipboard][rust] copy_image:start");

    let base64_part = image_data_url
        .split(',')
        .nth(1)
        .ok_or_else(|| "无效的 data URL 格式".to_string())?;

    let decode_started_at = std::time::Instant::now();
    let image_bytes = STANDARD
        .decode(base64_part)
        .map_err(|e| format!("base64 解码失败: {}", e))?;
    let decode_elapsed_ms = decode_started_at.elapsed().as_millis();

    let write_started_at = std::time::Instant::now();

    let img = image::load_from_memory(&image_bytes)
        .map_err(|e| format!("加载图片失败: {}", e))?;
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    unsafe {
        OpenClipboard(HWND(std::ptr::null_mut()))
            .map_err(|e| format!("打开剪贴板失败: {:?}", e))?;

        EmptyClipboard().map_err(|e| format!("清空剪贴板失败: {:?}", e))?;

        let bi_size = std::mem::size_of::<BITMAPINFOHEADER>();
        let row_size = ((width * 4 + 3) / 4) * 4;
        let pixel_data_size = (row_size * height) as usize;
        let total_size = bi_size + pixel_data_size;

        let h_global: HGLOBAL = GlobalAlloc(GMEM_MOVEABLE | GMEM_ZEROINIT, total_size)
            .map_err(|_| "分配内存失败".to_string())?;

        let ptr = GlobalLock(h_global) as *mut u8;
        if ptr.is_null() {
            return Err("锁定内存失败".to_string());
        }

        let bi = ptr as *mut BITMAPINFOHEADER;
        (*bi).biSize = bi_size as u32;
        (*bi).biWidth = width as i32;
        (*bi).biHeight = height as i32;
        (*bi).biPlanes = 1;
        (*bi).biBitCount = 32;
        (*bi).biCompression = 0;
        (*bi).biSizeImage = pixel_data_size as u32;
        (*bi).biXPelsPerMeter = 0;
        (*bi).biYPelsPerMeter = 0;
        (*bi).biClrUsed = 0;
        (*bi).biClrImportant = 0;

        let pixel_ptr = ptr.add(bi_size);
        for y in 0..height {
            for x in 0..width {
                let src_idx = ((height - 1 - y) * width + x) as usize * 4;
                let dst_idx = (y * row_size + x * 4) as usize;
                let r = rgba[src_idx];
                let g = rgba[src_idx + 1];
                let b = rgba[src_idx + 2];
                let a = rgba[src_idx + 3];
                *pixel_ptr.add(dst_idx) = b;
                *pixel_ptr.add(dst_idx + 1) = g;
                *pixel_ptr.add(dst_idx + 2) = r;
                *pixel_ptr.add(dst_idx + 3) = a;
            }
        }

        GlobalUnlock(h_global);

        const CF_DIB: u32 = 8;
        SetClipboardData(CF_DIB, Some(h_global.into()))
            .map_err(|e| format!("设置剪贴板数据失败: {:?}", e))?;

        CloseClipboard().map_err(|e| format!("关闭剪贴板失败: {:?}", e))?;
    }

    let write_elapsed_ms = write_started_at.elapsed().as_millis();

    let total_elapsed_ms = started_at.elapsed().as_millis();
    log::info!(
        "[clipboard][rust] copy_image:done decode_ms={} write_ms={} total_ms={}",
        decode_elapsed_ms,
        write_elapsed_ms,
        total_elapsed_ms
    );

    Ok(())
}

/// Linux: 使用 clipboard-rs
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
#[tauri::command]
pub async fn copy_image_to_clipboard(image_data_url: String) -> Result<(), String> {
    use clipboard_rs::{Clipboard, ClipboardContent, ClipboardContext, RustImageData};
    use clipboard_rs::common::RustImage;

    let started_at = std::time::Instant::now();
    log::info!("[clipboard][rust] copy_image:start");

    let base64_part = image_data_url
        .split(',')
        .nth(1)
        .ok_or_else(|| "无效的 data URL 格式".to_string())?;

    let decode_started_at = std::time::Instant::now();
    let image_bytes = STANDARD
        .decode(base64_part)
        .map_err(|e| format!("base64 解码失败: {}", e))?;
    let decode_elapsed_ms = decode_started_at.elapsed().as_millis();

    let load_started_at = std::time::Instant::now();
    let image = RustImageData::from_bytes(&image_bytes)
        .map_err(|e| format!("加载图片失败: {}", e))?;
    let load_elapsed_ms = load_started_at.elapsed().as_millis();

    let write_started_at = std::time::Instant::now();
    let ctx = ClipboardContext::new().map_err(|e| format!("获取剪贴板上下文失败: {}", e))?;
    ctx.set(vec![ClipboardContent::Image(image)])
        .map_err(|e| format!("写入剪贴板失败: {}", e))?;
    let write_elapsed_ms = write_started_at.elapsed().as_millis();

    let total_elapsed_ms = started_at.elapsed().as_millis();
    log::info!(
        "[clipboard][rust] copy_image:done decode_ms={} load_ms={} write_ms={} total_ms={}",
        decode_elapsed_ms,
        load_elapsed_ms,
        write_elapsed_ms,
        total_elapsed_ms
    );

    Ok(())
}
