use tauri::{command, AppHandle, Emitter, Manager, PhysicalPosition, Position, Runtime};
use serde_json::json;

pub static SEND_MODAL_WINDOW_LABEL: &str = "send-modal";

// 显示 SendModal 窗口
#[command]
pub async fn show_send_modal_window<R: Runtime>(
    app_handle: AppHandle<R>,
    item_id: String,
    item_type: String,
    service_type: String,
) -> Result<(), String> {
    println!("[send_modal] Attempting to show send-modal window, item_id: {}", item_id);

    let window = app_handle.get_webview_window(SEND_MODAL_WINDOW_LABEL);

    if let Some(window) = window {
        println!("[send_modal] Found send-modal window, setting position and showing");

        // 窗口尺寸
        let modal_width = 520;
        let modal_height = 600;

        // 获取当前显示器，计算屏幕中心位置
        let monitor = window
            .current_monitor()
            .map_err(|e| e.to_string())?;

        if let Some(monitor) = monitor {
            let monitor_size = monitor.size();
            let monitor_position = monitor.position();

            // 计算屏幕中心位置
            let center_x = monitor_position.x + (monitor_size.width as i32 - modal_width) / 2;
            let center_y = monitor_position.y + (monitor_size.height as i32 - modal_height) / 2;

            let _ = window.set_position(Position::Physical(PhysicalPosition::new(center_x, center_y)));
        }

        // 发送数据到窗口
        let _ = window.emit("send-modal-data", json!({
            "itemId": item_id,
            "itemType": item_type,
            "serviceType": service_type,
        }));

        // 显示窗口
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();

        println!("[send_modal] Window shown successfully");
    } else {
        println!("[send_modal] ERROR: send-modal window not found! Make sure it's defined in tauri.conf.json");
        return Err("Send-modal window not found".to_string());
    }

    Ok(())
}

// 隐藏 SendModal 窗口
#[command]
pub async fn hide_send_modal_window<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window(SEND_MODAL_WINDOW_LABEL) {
        let _ = window.hide();
    }
    Ok(())
}

// 关闭 SendModal 窗口（完全关闭而非隐藏）
#[command]
pub async fn close_send_modal_window<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window(SEND_MODAL_WINDOW_LABEL) {
        let _ = window.close();
    }
    Ok(())
}
