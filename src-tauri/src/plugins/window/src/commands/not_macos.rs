use super::{shared_hide_window, shared_show_window, TOAST_WINDOW_LABEL};
use std::time::Duration;
use tauri::{command, AppHandle, Manager, PhysicalPosition, Position, Runtime, WebviewWindow};

// 显示窗口
#[command]
pub async fn show_window<R: Runtime>(_app_handle: AppHandle<R>, window: WebviewWindow<R>) {
    shared_show_window(&window);
}

// 隐藏窗口
#[command]
pub async fn hide_window<R: Runtime>(_app_handle: AppHandle<R>, window: WebviewWindow<R>) {
    shared_hide_window(&window);
}

// 显示任务栏图标
#[command]
pub async fn show_taskbar_icon<R: Runtime>(
    _app_handle: AppHandle<R>,
    window: WebviewWindow<R>,
    visible: bool,
) {
    let _ = window.set_skip_taskbar(!visible);
}

// 显示 Toast 窗口
#[command]
pub async fn show_toast_window<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    let window = app_handle.get_webview_window(TOAST_WINDOW_LABEL);

    if let Some(window) = window {
        // 获取主显示器的位置和尺寸
        let monitor = window.current_monitor().map_err(|e| e.to_string())?;

        if let Some(monitor) = monitor {
            let monitor_size = monitor.size();
            let monitor_position = monitor.position();

            // Toast 窗口尺寸
            let toast_width = 200;
            let toast_height = 60;

            // 计算窗口位置：屏幕底部中间，距离底部 120px
            let x = monitor_position.x + (monitor_size.width as i32 - toast_width) / 2;
            let y = monitor_position.y + monitor_size.height as i32 - toast_height - 120;

            // 设置窗口位置
            let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
        }

        // 显示窗口
        let _ = window.show();

        // 2秒后自动隐藏
        let app_handle_clone = app_handle.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(2000));
            if let Some(window) = app_handle_clone.get_webview_window(TOAST_WINDOW_LABEL) {
                let _ = window.hide();
            }
        });
    }

    Ok(())
}

// 隐藏 Toast 窗口
#[command]
pub async fn hide_toast_window<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window(TOAST_WINDOW_LABEL) {
        let _ = window.hide();
    }
    Ok(())
}
