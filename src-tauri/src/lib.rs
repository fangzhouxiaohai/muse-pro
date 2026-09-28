use std::fs;
use std::path::{Path, PathBuf};

const MAX_TEXT_BYTES: u64 = 200 * 1024;

fn system_roots() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();
    #[cfg(target_os = "windows")]
    {
        if let Ok(system_root) = std::env::var("SystemRoot") {
            roots.push(PathBuf::from(&system_root));
            roots.push(PathBuf::from(system_root).join("System32"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        roots.push(PathBuf::from("/System"));
        roots.push(PathBuf::from("/Library"));
        roots.push(PathBuf::from("/private"));
    }
    roots
}

fn guard_target(path: &str, for_write: bool) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("请先提供文件路径。".into());
    }
    let target = PathBuf::from(trimmed);
    if target.is_dir() {
        return Err("这个路径指向的是目录，请指定一个文件。".into());
    }
    if for_write {
        for root in system_roots() {
            if target.starts_with(&root) {
                return Err("出于安全考虑，工作台不允许写入系统目录。".into());
            }
        }
    }
    Ok(target)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let target = guard_target(&path, false)?;
    if !target.is_file() {
        return Err("没有找到这个文件，请确认路径是否正确。".into());
    }
    let meta = fs::metadata(&target).map_err(|error| format!("无法读取文件信息：{error}"))?;
    if meta.len() > MAX_TEXT_BYTES {
        return Err("文件超过 200 KB，请先拆分后再加入工作台。".into());
    }
    fs::read_to_string(&target).map_err(|_| "这个文件不是可读取的 UTF-8 文本文件。".to_string())
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<String, String> {
    let target = guard_target(&path, true)?;
    if content.len() as u64 > MAX_TEXT_BYTES {
        return Err("内容超过 200 KB，请拆分为多个文件后再写入。".into());
    }
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent).map_err(|error| format!("无法创建目录：{error}"))?;
        }
    }
    fs::write(&target, content.as_bytes()).map_err(|error| format!("写入文件失败：{error}"))?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    Path::new(path.trim()).is_file()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![read_text_file, write_text_file, file_exists])
        .run(tauri::generate_context!())
        .expect("无法启动 Muse Pro");
}
