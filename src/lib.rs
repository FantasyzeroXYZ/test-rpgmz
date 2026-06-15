// =============================================================================
// rm-wasm-vfs — Virtual File System for RPG Maker MZ in WebAssembly
// =============================================================================
// Compile: wasm-pack build --target web
// =============================================================================

use wasm_bindgen::prelude::*;
use std::collections::HashMap;
use std::sync::Mutex;

// -----------------------------------------------------------------------------
// Global singleton VFS — a Mutex-wrapped Option<HashMap> keyed by file path.
// Wrapping in Option lets us take() the entire map to force deallocation.
// -----------------------------------------------------------------------------
static VIRTUAL_FS: Mutex<Option<HashMap<String, Vec<u8>>>> = Mutex::new(None);

// -----------------------------------------------------------------------------
// Helper: acquire a locked reference, panicking safely into a JS error.
// -----------------------------------------------------------------------------
fn lock_fs() -> std::sync::MutexGuard<'static, Option<HashMap<String, Vec<u8>>>> {
    VIRTUAL_FS
        .lock()
        .expect("VIRTUAL_FS mutex poisoned — unrecoverable")
}

// =============================================================================
// RPGMV Encryption — decrypt in Rust so JS gets clean Vec<u8> for Blob()
// =============================================================================

const RPGMV_HEADER: [u8; 16] = [
    0x52, 0x50, 0x47, 0x4D, 0x56, 0x00, 0x00, 0x00,
    0x00, 0x03, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00
];

fn is_rpgmv_encrypted(data: &[u8]) -> bool {
    data.len() >= 16 && data[..16] == RPGMV_HEADER
}

fn decrypt_rpgmv(data: &[u8], hex_key: &str) -> Option<Vec<u8>> {
    if hex_key.len() < 32 { return None; }
    let key: Vec<u8> = (0..16)
        .map(|i| u8::from_str_radix(&hex_key[i*2..i*2+2], 16).unwrap_or(0))
        .collect();
    let body = &data[16..];
    // RPG Maker MZ/MV only encrypts the first 16 bytes of the body.
    // Rest is plaintext. Matches engine's decryptArrayBuffer.
    let mut result = body.to_vec();
    for i in 0..16.min(result.len()) {
        result[i] ^= key[i];
    }
    Some(result)
}

// -----------------------------------------------------------------------------
// #[wasm_bindgen] exported API
// -----------------------------------------------------------------------------

/// Initialise (or reset) the virtual file system.
/// If the map already exists it is dropped and a fresh empty one is created.
#[wasm_bindgen]
pub fn init_fs() {
    let mut guard = lock_fs();
    *guard = Some(HashMap::new());
}

/// Write raw bytes into the virtual file system at the given path.
#[wasm_bindgen]
pub fn write_file(path: &str, data: &[u8]) {
    let mut guard = lock_fs();
    let fs = guard.get_or_insert_with(HashMap::new);
    fs.insert(path.to_owned(), data.to_vec());
}

/// Return true if a file exists at `path`.
#[wasm_bindgen]
pub fn has_file(path: &str) -> bool {
    let guard = lock_fs();
    guard
        .as_ref()
        .map(|fs| fs.contains_key(path))
        .unwrap_or(false)
}

/// Return raw bytes stored at `path`, or `None` if not found.
#[wasm_bindgen]
pub fn read_file(path: &str) -> Option<Vec<u8>> {
    let guard = lock_fs();
    guard
        .as_ref()
        .and_then(|fs| fs.get(path).cloned())
}

/// Return decrypted bytes if the file is RPGMV-encrypted, or raw bytes if not.
/// Accepts a 32-char hex encryption key. Returns `None` if file not found.
///
/// This is the PREFERRED way to read encrypted assets — Rust performs the
/// XOR decryption and returns a clean `Vec<u8>` that JS can pass directly
/// to `new Blob()` without buffer compatibility issues.
#[wasm_bindgen]
pub fn read_file_decrypted(path: &str, hex_key: &str) -> Option<Vec<u8>> {
    let guard = lock_fs();
    let fs = guard.as_ref()?;
    let data = fs.get(path)?;

    if is_rpgmv_encrypted(data) {
        decrypt_rpgmv(data, hex_key)
    } else {
        Some(data.clone())
    }
}

/// Clear the entire virtual file system, freeing all memory immediately.
#[wasm_bindgen]
pub fn clear_fs() {
    let mut guard = lock_fs();
    let old = guard.take();
    drop(old);
    *guard = Some(HashMap::new());
}

/// Return the number of files currently stored.
#[wasm_bindgen]
pub fn file_count() -> usize {
    let guard = lock_fs();
    guard
        .as_ref()
        .map(|fs| fs.len())
        .unwrap_or(0)
}

/// Return a JS array of all file paths.
#[wasm_bindgen]
pub fn list_paths() -> Box<[JsValue]> {
    let guard = lock_fs();
    let empty = HashMap::new();
    let fs = guard.as_ref().unwrap_or(&empty);
    fs.keys()
        .map(|k| JsValue::from_str(k))
        .collect::<Vec<_>>()
        .into_boxed_slice()
}

// =============================================================================
// Unit tests
// =============================================================================
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn smoke_init_and_write() {
        init_fs();
        assert_eq!(file_count(), 0);
        write_file("data/System.json", b"{\"test\":true}");
        assert_eq!(file_count(), 1);
        assert!(has_file("data/System.json"));
        assert!(!has_file("nonexistent.json"));
    }

    #[test]
    fn smoke_read() {
        init_fs();
        write_file("hello.txt", b"Hello WASM!");
        let data = read_file("hello.txt").expect("file should exist");
        assert_eq!(data, b"Hello WASM!");
        assert!(read_file("missing.txt").is_none());
    }

    #[test]
    fn smoke_clear() {
        init_fs();
        write_file("a.txt", b"a");
        write_file("b.txt", b"b");
        assert_eq!(file_count(), 2);
        clear_fs();
        assert_eq!(file_count(), 0);
        write_file("c.txt", b"c");
        assert!(has_file("c.txt"));
    }

    #[test]
    fn smoke_overwrite() {
        init_fs();
        write_file("x.txt", b"v1");
        write_file("x.txt", b"v2");
        let data = read_file("x.txt").unwrap();
        assert_eq!(data, b"v2");
    }

    #[test]
    fn smoke_list_paths() {
        init_fs();
        write_file("a/b.json", b"{}");
        write_file("c/d.json", b"{}");
        let paths = list_paths();
        assert_eq!(paths.len(), 2);
    }

    #[test]
    fn test_rpgmv_decrypt() {
        // Build a fake RPGMV-encrypted file: header + "hello world" XOR'd with key
        let key = "0102030405060708090a0b0c0d0e0f10"; // 16 bytes
        let plain: Vec<u8> = b"hello world!!!!".to_vec(); // 16 bytes
        let mut enc = RPGMV_HEADER.to_vec();
        let key_bytes: Vec<u8> = (0..16).map(|i| i as u8 + 1).collect();
        for (i, &b) in plain.iter().enumerate() {
            enc.push(b ^ key_bytes[i % 16]);
        }
        write_file("test.png_", &enc);
        let dec = read_file_decrypted("test.png_", key).expect("decrypt");
        assert_eq!(&dec, &plain);
    }

    #[test]
    fn test_rpgmv_non_encrypted_passthrough() {
        init_fs();
        write_file("plain.txt", b"just text");
        let dec = read_file_decrypted("plain.txt", "0102030405060708090a0b0c0d0e0f10").expect("passthrough");
        assert_eq!(dec, b"just text");
    }
}
