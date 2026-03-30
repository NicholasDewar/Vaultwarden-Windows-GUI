use std::fs;
use std::io;
use std::path::Path;

pub fn write_atomic<P: AsRef<Path>>(path: P, content: &[u8]) -> io::Result<()> {
    let path = path.as_ref();
    let temp_path = path.with_extension("tmp");

    fs::write(&temp_path, content)?;

    #[cfg(windows)]
    {
        let _ = fs::remove_file(path);
    }

    fs::rename(&temp_path, path)?;
    Ok(())
}

pub fn write_atomic_string<P: AsRef<Path>>(path: P, content: &str) -> Result<(), String> {
    write_atomic(path, content.as_bytes()).map_err(|e| e.to_string())
}

pub fn copy_atomic<P: AsRef<Path>>(from: P, to: P) -> Result<(), String> {
    let from = from.as_ref();
    let to = to.as_ref();

    if !from.exists() {
        return Err(format!("Source file not found: {:?}", from));
    }

    let temp_path = to.with_extension("tmp");

    fs::copy(from, &temp_path).map_err(|e| e.to_string())?;

    #[cfg(windows)]
    {
        let _ = fs::remove_file(to);
    }

    fs::rename(&temp_path, to).map_err(|e| e.to_string())?;
    Ok(())
}
