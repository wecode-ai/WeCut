#![allow(deprecated)]
use cocoa::base::{id, nil};
use cocoa::foundation::NSAutoreleasePool;
use objc::runtime::Class;
use objc::{msg_send, sel, sel_impl};
use serde::Serialize;
use std::ffi::CStr;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{command, AppHandle, Manager, Runtime};

#[derive(Debug, Serialize)]
pub struct ActiveAppInfo {
    pub name: Option<String>,
    pub path: Option<String>,
    pub bundle_id: Option<String>,
}

#[command]
pub async fn get_active_app<R: Runtime>(
    _app_handle: AppHandle<R>,
) -> Result<ActiveAppInfo, String> {
    unsafe {
        let _pool = NSAutoreleasePool::new(nil);

        let workspace: id = msg_send![Class::get("NSWorkspace").unwrap(), sharedWorkspace];
        let app: id = msg_send![workspace, frontmostApplication];

        if app == nil {
            return Ok(ActiveAppInfo {
                name: None,
                path: None,
                bundle_id: None,
            });
        }

        // 获取应用名称
        let localized_name: id = msg_send![app, localizedName];
        let name = if localized_name != nil {
            let name_str: *const i8 = msg_send![localized_name, UTF8String];
            Some(CStr::from_ptr(name_str).to_str().unwrap_or("").to_string())
        } else {
            None
        };

        // 获取 Bundle Identifier
        let bundle_identifier: id = msg_send![app, bundleIdentifier];
        let bundle_id = if bundle_identifier != nil {
            let id_str: *const i8 = msg_send![bundle_identifier, UTF8String];
            Some(CStr::from_ptr(id_str).to_str().unwrap_or("").to_string())
        } else {
            None
        };

        // 获取应用路径
        let bundle_url: id = msg_send![app, bundleURL];
        let path = if bundle_url != nil {
            let path_ns: id = msg_send![bundle_url, path];
            if path_ns != nil {
                let path_str: *const i8 = msg_send![path_ns, UTF8String];
                Some(CStr::from_ptr(path_str).to_str().unwrap_or("").to_string())
            } else {
                None
            }
        } else {
            None
        };

        Ok(ActiveAppInfo {
            name,
            path,
            bundle_id,
        })
    }
}

#[command]
pub async fn get_app_icon<R: Runtime>(
    app_handle: AppHandle<R>,
    bundle_id: String,
    app_path: Option<String>,
) -> Result<Option<String>, String> {
    // 确定缓存目录
    let cache_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("app-icons");

    fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let icon_path = cache_dir.join(format!("{}.png", bundle_id.replace('.', "_")));

    // 已缓存则直接返回
    if icon_path.exists() {
        return Ok(Some(icon_path.to_string_lossy().to_string()));
    }

    // 获取应用路径
    let resolved_path = if let Some(ref p) = app_path {
        PathBuf::from(p)
    } else {
        // 通过 bundle_id 查找应用路径
        let output = Command::new("mdfind")
            .args(["kMDItemCFBundleIdentifier", "=", &bundle_id])
            .output()
            .map_err(|e| e.to_string())?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let found_path = stdout.lines().next().unwrap_or("").trim().to_string();

        if found_path.is_empty() {
            return Ok(None);
        }

        PathBuf::from(found_path)
    };

    // 使用 sips 提取图标
    // 先找到 .icns 文件
    let icon_file = find_app_icon(&resolved_path);

    if let Some(icns_path) = icon_file {
        let result = Command::new("sips")
            .args([
                "-s",
                "format",
                "png",
                "-z",
                "64",
                "64",
                &icns_path,
                "--out",
                &icon_path.to_string_lossy(),
            ])
            .output();

        match result {
            Ok(output) if output.status.success() => {
                return Ok(Some(icon_path.to_string_lossy().to_string()));
            }
            _ => {
                return Ok(None);
            }
        }
    }

    Ok(None)
}

/// 在 .app bundle 中查找图标文件
fn find_app_icon(app_path: &PathBuf) -> Option<String> {
    // 读取 Info.plist 获取图标文件名
    let plist_path = app_path.join("Contents/Info.plist");

    if !plist_path.exists() {
        return None;
    }

    // 使用 defaults read 获取 CFBundleIconFile
    let output = Command::new("defaults")
        .args(["read", &plist_path.to_string_lossy(), "CFBundleIconFile"])
        .output()
        .ok()?;

    let icon_name = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if icon_name.is_empty() {
        return None;
    }

    let icon_name = if icon_name.ends_with(".icns") {
        icon_name
    } else {
        format!("{}.icns", icon_name)
    };

    let icns_path = app_path.join("Contents/Resources").join(&icon_name);

    if icns_path.exists() {
        Some(icns_path.to_string_lossy().to_string())
    } else {
        None
    }
}
