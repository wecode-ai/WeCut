mod core;
mod plugins;
mod screenshot;

use core::{prevent_default, setup};
use std::env;
use tauri::{generate_context, generate_handler, Builder, Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_eco_window::{show_main_window, MAIN_WINDOW_LABEL, PREFERENCE_WINDOW_LABEL};
use tauri_plugin_log::{Target, TargetKind};

// 读取系统环境变量
#[tauri::command]
fn get_system_env(key: String) -> Option<String> {
    env::var(key).ok()
}

// 内容超过此字节数时转为附件发送
const CONTENT_ATTACHMENT_THRESHOLD: usize = 2048;

// 发送消息到 Work Queue
#[tauri::command]
async fn send_to_work_queue(
    base_url: String,
    api_token: String,
    queue_name: String,
    note: Option<String>,
    title: Option<String>,
    content: Option<String>,
    file_paths: Vec<String>,
) -> Result<(), String> {
    use reqwest::multipart::{Form, Part};
    use reqwest::Client;

    let url = format!(
        "{}/api/work-queues/by-name/{}/messages/ingest",
        base_url,
        urlencoding::encode(&queue_name)
    );

    log::info!(
        "[send_to_work_queue] url={}, content_len={:?}, files_count={}",
        url,
        content.as_ref().map(|s| s.len()),
        file_paths.len()
    );

    // 创建客户端，禁用代理
    let client = Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("创建客户端失败: {}", e))?;

    let mut form = Form::new();

    // 添加 content（剪切板文本内容）
    // 超过 2k 时转为临时文件作为附件发送，避免内容过长导致请求失败
    let mut temp_file_path: Option<std::path::PathBuf> = None;
    if let Some(text) = content {
        if text.len() > CONTENT_ATTACHMENT_THRESHOLD {
            log::info!(
                "[send_to_work_queue] content length {} exceeds threshold {}, converting to attachment",
                text.len(),
                CONTENT_ATTACHMENT_THRESHOLD
            );
            // 写入临时文件
            let tmp_dir = std::env::temp_dir();
            let tmp_file = tmp_dir.join(format!("wecut_content_{}.txt", uuid_v4()));
            tokio::fs::write(&tmp_file, text.as_bytes())
                .await
                .map_err(|e| format!("写入临时文件失败: {}", e))?;
            temp_file_path = Some(tmp_file);
        } else {
            form = form.text("content", text);
        }
    }

    // 添加 note（备注）
    if let Some(n) = note {
        form = form.text("note", n);
    }

    // 添加 title（标题）
    if let Some(t) = title {
        form = form.text("title", t);
    }

    // 添加文件附件（原始文件）
    for file_path in &file_paths {
        let file_content = tokio::fs::read(file_path)
            .await
            .map_err(|e| format!("读取文件失败 {}: {}", file_path, e))?;
        let file_name = std::path::Path::new(file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file")
            .to_string();

        let part = Part::bytes(file_content)
            .file_name(file_name)
            .mime_str("application/octet-stream")
            .map_err(|e| e.to_string())?;
        form = form.part("files", part);
    }

    // 添加超长内容转换的临时文件附件
    if let Some(ref tmp_path) = temp_file_path {
        let file_content = tokio::fs::read(tmp_path)
            .await
            .map_err(|e| format!("读取临时文件失败: {}", e))?;
        let file_name = tmp_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("content.txt")
            .to_string();
        let part = Part::bytes(file_content)
            .file_name(file_name)
            .mime_str("text/plain; charset=utf-8")
            .map_err(|e| e.to_string())?;
        form = form.part("files", part);
    }

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_token))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    log::info!(
        "[send_to_work_queue] Response status: {}",
        response.status()
    );

    // 清理临时文件（无论成功或失败）
    if let Some(ref tmp_path) = temp_file_path {
        let _ = tokio::fs::remove_file(tmp_path).await;
    }

    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        log::error!("[send_to_work_queue] Error: HTTP {}: {}", status, body);
        Err(format!("HTTP {}: {}", status, body))
    }
}

// 生成简单的唯一 ID（基于时间戳 + 随机数）
fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{:x}", ts)
}

// 获取工作队列列表
#[tauri::command]
async fn fetch_work_queues(
    base_url: String,
    api_token: String,
) -> Result<serde_json::Value, String> {
    use reqwest::Client;

    let url = format!("{}/api/work-queues", base_url.trim_end_matches('/'));

    log::info!("[fetch_work_queues] url={}", url);

    let client = Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("创建客户端失败: {}", e))?;

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_token))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    log::info!("[fetch_work_queues] status={}", response.status());

    if response.status().is_success() {
        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;
        Ok(data)
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        Err(format!("HTTP {}: {}", status, body))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = Builder::default()
        .setup(|app| {
            let app_handle = app.handle();

            let main_window = app.get_webview_window(MAIN_WINDOW_LABEL).unwrap();

            let preference_window = app.get_webview_window(PREFERENCE_WINDOW_LABEL).unwrap();

            // 验证 send-modal 窗口是否存在
            let send_modal_window = app.get_webview_window("send-modal");
            if send_modal_window.is_some() {
                log::info!("[setup] send-modal window found");
            } else {
                log::warn!("[setup] send-modal window not found!");
            }

            setup::default(&app_handle, main_window.clone(), preference_window.clone());

            Ok(())
        })
        // 确保在 windows 和 linux 上只有一个 app 实例在运行：https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/single-instance
        .plugin({
            tauri_plugin_single_instance::init(|app_handle, _argv, _cwd| {
                show_main_window(app_handle);
            })
        })
        // app 自启动：https://github.com/tauri-apps/tauri-plugin-autostart/tree/v2
        .plugin({
            tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--auto-launch"]))
        })
        // 数据库：https://github.com/tauri-apps/tauri-plugin-sql/tree/v2
        .plugin({
            tauri_plugin_sql::Builder::default().build()
        })
        // 日志插件：https://github.com/tauri-apps/tauri-plugin-log/tree/v2
        .plugin({
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .build()
        })
        // 快捷键插件: https://github.com/tauri-apps/tauri-plugin-global-shortcut
        .plugin({
            tauri_plugin_global_shortcut::Builder::new().build()
        })
        // 操作系统相关信息插件：https://github.com/tauri-apps/tauri-plugin-os
        .plugin({
            tauri_plugin_os::init()
        })
        // 系统级别对话框插件：https://github.com/tauri-apps/tauri-plugin-dialog
        .plugin({
            tauri_plugin_dialog::init()
        })
        // 访问文件系统插件：https://github.com/tauri-apps/tauri-plugin-fs
        .plugin({
            tauri_plugin_fs::init()
        })
        // 更新插件：https://github.com/tauri-apps/tauri-plugin-updater
        .plugin({
            tauri_plugin_updater::Builder::new().build()
        })
        // 进程相关插件：https://github.com/tauri-apps/tauri-plugin-process
        .plugin({
            tauri_plugin_process::init()
        })
        // 检查和请求 macos 系统权限：https://github.com/ayangweb/tauri-plugin-macos-permissions
        .plugin({
            tauri_plugin_macos_permissions::init()
        })
        // 拓展了对文件和目录的操作：https://github.com/ayangweb/tauri-plugin-fs-pro
        .plugin({
            tauri_plugin_fs_pro::init()
        })
        // 获取系统获取系统的区域设置：https://github.com/ayangweb/tauri-plugin-locale
        .plugin({
            tauri_plugin_locale::init()
        })
        // 打开文件或者链接：https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/opener
        .plugin({
            tauri_plugin_opener::init()
        })
        // HTTP 请求插件：https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/http
        .plugin({
            tauri_plugin_http::init()
        })
        // 禁用 webview 的默认行为：https://github.com/ferreira-tb/tauri-plugin-prevent-default
        .plugin({
            prevent_default::init()
        })
        // 剪贴板插件：https://github.com/ayangweb/tauri-plugin-clipboard-x
        .plugin({
            tauri_plugin_clipboard_x::init()
        })
        // 自定义的窗口管理插件
        .plugin({
            tauri_plugin_eco_window::init()
        })
        // 自定义粘贴的插件
        .plugin({
            tauri_plugin_eco_paste::init()
        })
        // 自定义判断是否自动启动的插件
        .plugin({
            tauri_plugin_eco_autostart::init()
        })
        // 获取活跃应用信息的插件
        .plugin({
            tauri_plugin_eco_active_app::init()
        })
        // 文本扩展插件
        .plugin({
            plugins::text_expansion::init()
        })
        .invoke_handler(generate_handler![
            get_system_env,
            send_to_work_queue,
            fetch_work_queues,
            plugins::text_expansion::commands::set_text_expansion_prefix,
            plugins::text_expansion::commands::set_text_expansions,
            plugins::text_expansion::commands::set_text_expansion_enabled,
            screenshot::get_monitors,
            screenshot::get_monitor_id_from_point,
            screenshot::capture_screen,
            screenshot::show_screenshot_window,
            screenshot::hide_screenshot_window,
            screenshot::pin_screenshot_window,
            screenshot::get_screenshot_data,
            screenshot::get_screenshot_crop,
            screenshot::create_pin_window,
            screenshot::get_pin_data,
            screenshot::close_pin_window,
            screenshot::ocr_image,
            screenshot::get_window_list,
            screenshot::copy_image_to_clipboard,
        ])
        .on_window_event(|window, event| match event {
            // 让 app 保持在后台运行：https://tauri.app/v1/guides/features/system-tray/#preventing-the-app-from-closing
            // pin 窗口（pin-N）和动态截图窗口（screenshot-N）允许真正关闭
            WindowEvent::CloseRequested { api, .. } => {
                let label = window.label();
                if label.starts_with("pin-") || label.starts_with("screenshot-") {
                    // 动态创建的窗口：允许真正关闭
                } else {
                    // 预创建的固定窗口：隐藏保留
                    window.hide().unwrap();
                    api.prevent_close();

                    // macOS：关闭偏好设置窗口时隐藏 dock 图标
                    #[cfg(target_os = "macos")]
                    if label == PREFERENCE_WINDOW_LABEL {
                        let _ = window.app_handle().set_dock_visibility(false);
                    }
                }
            }
            _ => {}
        })
        .build(generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, event| match event {
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen {
            has_visible_windows,
            ..
        } => {
            if has_visible_windows {
                return;
            }

            tauri_plugin_eco_window::show_preference_window(app_handle);
        }
        _ => {
            let _ = app_handle;
        }
    });
}
