use super::{is_main_window, shared_hide_window, shared_show_window, TOAST_WINDOW_LABEL};
use crate::MAIN_WINDOW_LABEL;
use std::time::Duration;
use tauri::{command, AppHandle, Manager, PhysicalPosition, Position, Runtime, WebviewWindow};
use tauri_nspanel::{CollectionBehavior, ManagerExt};

pub enum MacOSPanelStatus {
    Show,
    Hide,
    Resign,
}

// 显示窗口
#[command]
pub async fn show_window<R: Runtime>(app_handle: AppHandle<R>, window: WebviewWindow<R>) {
    if is_main_window(&window) {
        set_macos_panel(&app_handle, &window, MacOSPanelStatus::Show);
    } else {
        shared_show_window(&window);
    }
}

// 隐藏窗口
#[command]
pub async fn hide_window<R: Runtime>(app_handle: AppHandle<R>, window: WebviewWindow<R>) {
    if is_main_window(&window) {
        set_macos_panel(&app_handle, &window, MacOSPanelStatus::Hide);
    } else {
        shared_hide_window(&window);
    }
}

// 显示任务栏图标
#[command]
pub async fn show_taskbar_icon<R: Runtime>(
    app_handle: AppHandle<R>,
    _window: WebviewWindow<R>,
    visible: bool,
) {
    let _ = app_handle.set_dock_visibility(visible);
}

// 设置 macos 的 ns_panel 的状态
pub fn set_macos_panel<R: Runtime>(
    app_handle: &AppHandle<R>,
    window: &WebviewWindow<R>,
    status: MacOSPanelStatus,
) {
    if is_main_window(window) {
        let app_handle_clone = app_handle.clone();

        let _ = app_handle.run_on_main_thread(move || {
            if let Ok(panel) = app_handle_clone.get_webview_panel(MAIN_WINDOW_LABEL) {
                match status {
                    MacOSPanelStatus::Show => {
                        panel.show_and_make_key();

                        panel.set_collection_behavior(
                            CollectionBehavior::new()
                                .stationary()
                                .can_join_all_spaces()
                                .full_screen_auxiliary()
                                .into(),
                        );
                    }
                    MacOSPanelStatus::Hide => {
                        panel.hide();

                        panel.set_collection_behavior(
                            CollectionBehavior::new()
                                .stationary()
                                .move_to_active_space()
                                .full_screen_auxiliary()
                                .into(),
                        );
                    }
                    MacOSPanelStatus::Resign => {
                        panel.resign_key_window();
                    }
                }
            }
        });
    }
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
            let toast_height = 200;

            // 计算窗口位置：屏幕底部往上 30% 的位置
            let x = monitor_position.x + (monitor_size.width as i32 - toast_width) / 2;
            let y = monitor_position.y + (monitor_size.height as i32 * 70 / 100) - toast_height;

            // 设置窗口位置
            let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
        }

        // 显示窗口
        let _ = window.show();

        // 1.5秒后自动隐藏（给动画留出时间）
        let app_handle_clone = app_handle.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(1500));
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
