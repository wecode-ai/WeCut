use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager};
use xcap::Monitor;

const SCREENSHOT_WINDOW_LABEL: &str = "screenshot";

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
            width: m.width().map_err(|e| format!("获取显示器宽度失败: {}", e))?,
            height: m.height().map_err(|e| format!("获取显示器高度失败: {}", e))?,
            scale_factor: m.scale_factor().map_err(|e| format!("获取显示器缩放比例失败: {}", e))?,
            is_primary: m.is_primary().map_err(|e| format!("获取显示器主屏状态失败: {}", e))?,
        });
    }

    Ok(infos)
}

/// 截取指定显示器的屏幕，返回 PNG base64 字符串
#[tauri::command]
pub async fn capture_screen(monitor_index: usize) -> Result<String, String> {
    let monitors = Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;

    let monitor = monitors
        .get(monitor_index)
        .ok_or_else(|| format!("显示器索引 {} 不存在", monitor_index))?;

    let image = monitor
        .capture_image()
        .map_err(|e| format!("截图失败: {}", e))?;

    // 编码为 PNG bytes
    let mut bytes: Vec<u8> = Vec::new();
    use image::ImageEncoder;
    let encoder = image::codecs::png::PngEncoder::new(&mut bytes);
    encoder
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            image::ColorType::Rgba8.into(),
        )
        .map_err(|e| format!("编码图片失败: {}", e))?;

    // 转为 base64
    let b64 = STANDARD.encode(&bytes);
    Ok(format!("data:image/png;base64,{}", b64))
}

/// 使用 macOS 原生 API (Core Graphics) 截取指定显示器，返回 JPEG base64
/// 比 xcap + image crate 快很多（硬件加速，无需 RGBA→RGB 转换）
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

    // 1. 用 CGDisplayCreateImage 截图（macOS 原生，硬件加速）
    let t1 = std::time::Instant::now();
    let display = CGDisplay::new(display_id);
    let cg_image = display
        .image()
        .ok_or_else(|| "CGDisplayCreateImage 返回 null".to_string())?;
    eprintln!("[screenshot] CGDisplayCreateImage: {:?}", t1.elapsed());

    // 2. 用 CGImageDestination 将 CGImage 编码为 JPEG（macOS 原生编码器）
    let t2 = std::time::Instant::now();

    // 使用 ImageIO framework 的 CGImageDestination
    // 通过 objc/core-foundation 调用
    let jpeg_data = unsafe {
        // 创建可变 CFMutableData 作为输出缓冲
        let mutable_data_ref: core_foundation::data::CFDataRef = {
            extern "C" {
                fn CFDataCreateMutable(
                    allocator: *const c_void,
                    capacity: isize,
                ) -> CFDataRef;
            }
            CFDataCreateMutable(std::ptr::null(), 0)
        };

        // UTType for JPEG
        let uti = CFString::new("public.jpeg");

        // CGImageDestinationCreateWithData
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

        // 设置 JPEG 质量
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

        // 读取编码后的字节
        let len = CFDataGetLength(mutable_data_ref) as usize;
        let ptr = CFDataGetBytePtr(mutable_data_ref);
        let bytes = std::slice::from_raw_parts(ptr, len).to_vec();
        CFRelease(mutable_data_ref as *const c_void);
        bytes
    };

    eprintln!(
        "[screenshot] CGImageDestination JPEG encode: {:?}, bytes: {}",
        t2.elapsed(),
        jpeg_data.len()
    );

    Ok(jpeg_data)
}

/// 获取 xcap Monitor 对应的 CGDirectDisplayID
#[cfg(target_os = "macos")]
fn get_cg_display_id(monitor_index: usize) -> Result<u32, String> {
    use core_graphics::display::CGDisplay;

    // CGGetActiveDisplayList 获取所有活跃显示器
    let displays = CGDisplay::active_displays()
        .map_err(|e| format!("CGGetActiveDisplayList 失败: {:?}", e))?;

    displays
        .get(monitor_index)
        .copied()
        .ok_or_else(|| format!("显示器索引 {} 不存在", monitor_index))
}

/// 显示截图窗口，并设置其大小和位置以覆盖指定显示器
/// 先显示窗口（减少感知延迟），再在后台截图并通过 event 推送给前端
#[tauri::command]
pub async fn show_screenshot_window(
    app: AppHandle,
    monitor_index: usize,
) -> Result<(), String> {
    let t0 = std::time::Instant::now();
    let monitors = Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;

    let monitor = monitors
        .get(monitor_index)
        .ok_or_else(|| format!("显示器索引 {} 不存在", monitor_index))?;

    let x = monitor.x().map_err(|e| format!("获取显示器X坐标失败: {}", e))?;
    let y = monitor.y().map_err(|e| format!("获取显示器Y坐标失败: {}", e))?;
    let width = monitor.width().map_err(|e| format!("获取显示器宽度失败: {}", e))?;
    let height = monitor.height().map_err(|e| format!("获取显示器高度失败: {}", e))?;

    if let Some(window) = app.get_webview_window(SCREENSHOT_WINDOW_LABEL) {
        // xcap 在 macOS 上返回的 width/height 是逻辑像素（points），直接用 LogicalSize
        // 临时允许 resize 以便能够设置窗口大小
        window
            .set_resizable(true)
            .map_err(|e| format!("设置窗口可调整大小失败: {}", e))?;

        window
            .set_position(LogicalPosition::new(x as f64, y as f64))
            .map_err(|e| format!("设置窗口位置失败: {}", e))?;

        window
            .set_size(LogicalSize::new(width as f64, height as f64))
            .map_err(|e| format!("设置窗口大小失败: {}", e))?;

        window
            .set_always_on_top(true)
            .map_err(|e| format!("设置置顶失败: {}", e))?;

        window
            .show()
            .map_err(|e| format!("显示窗口失败: {}", e))?;

        window
            .set_focus()
            .map_err(|e| format!("聚焦窗口失败: {}", e))?;

        eprintln!("[screenshot] window shown in {:?}", t0.elapsed());

        // 在后台截图并通过 event 推送
        let app_clone = app.clone();
        tokio::spawn(async move {
            let result: Result<(), String> = (|| {
                let t1 = std::time::Instant::now();

                #[cfg(target_os = "macos")]
                {
                    // 使用 macOS 原生 API 截图（最快路径）
                    let display_id = get_cg_display_id(monitor_index)?;
                    eprintln!("[screenshot] get display_id={} in {:?}", display_id, t1.elapsed());

                    let jpeg_bytes = capture_screen_native_jpeg(display_id, 0.85)?;

                    let t5 = std::time::Instant::now();
                    let image_data_url = format!(
                        "data:image/jpeg;base64,{}",
                        STANDARD.encode(&jpeg_bytes)
                    );
                    eprintln!("[screenshot] base64 encode: {:?}, len: {}", t5.elapsed(), image_data_url.len());

                    let t6 = std::time::Instant::now();
                    if let Some(win) = app_clone.get_webview_window(SCREENSHOT_WINDOW_LABEL) {
                        win.emit("screenshot:ready", &image_data_url)
                            .map_err(|e| format!("发送截图数据失败: {}", e))?;
                    }
                    eprintln!("[screenshot] emit event: {:?}", t6.elapsed());
                    eprintln!("[screenshot] total spawn task: {:?}", t1.elapsed());
                }

                #[cfg(not(target_os = "macos"))]
                {
                    // 非 macOS 平台回退到 xcap + image crate
                    let monitors = Monitor::all().map_err(|e| format!("获取显示器失败: {}", e))?;
                    let monitor = monitors
                        .get(monitor_index)
                        .ok_or_else(|| format!("显示器索引 {} 不存在", monitor_index))?;

                    let t2 = std::time::Instant::now();
                    let image = monitor
                        .capture_image()
                        .map_err(|e| format!("截图失败: {}", e))?;
                    eprintln!("[screenshot] capture_image: {:?}", t2.elapsed());

                    let t3 = std::time::Instant::now();
                    let w = image.width();
                    let h = image.height();
                    let rgba_raw = image.into_raw();
                    let rgb_raw: Vec<u8> = rgba_raw
                        .chunks_exact(4)
                        .flat_map(|p| [p[0], p[1], p[2]])
                        .collect();
                    eprintln!("[screenshot] rgba->rgb: {:?}", t3.elapsed());

                    let t4 = std::time::Instant::now();
                    let mut bytes: Vec<u8> = Vec::new();
                    use image::ImageEncoder;
                    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut bytes, 85);
                    encoder
                        .encode(&rgb_raw, w, h, image::ColorType::Rgb8.into())
                        .map_err(|e| format!("编码图片失败: {}", e))?;
                    eprintln!("[screenshot] jpeg encode: {:?}", t4.elapsed());

                    let image_data_url = format!("data:image/jpeg;base64,{}", STANDARD.encode(&bytes));

                    if let Some(win) = app_clone.get_webview_window(SCREENSHOT_WINDOW_LABEL) {
                        win.emit("screenshot:ready", &image_data_url)
                            .map_err(|e| format!("发送截图数据失败: {}", e))?;
                    }
                    eprintln!("[screenshot] total spawn task: {:?}", t1.elapsed());
                }

                Ok(())
            })();
            if let Err(e) = result {
                eprintln!("截图后台任务失败: {}", e);
            }
        });
    } else {
        return Err("截图窗口未找到".to_string());
    }

    Ok(())
}

/// 隐藏截图窗口
#[tauri::command]
pub async fn hide_screenshot_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(SCREENSHOT_WINDOW_LABEL) {
        window
            .hide()
            .map_err(|e| format!("隐藏截图窗口失败: {}", e))?;
    }
    Ok(())
}
