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

// -----------------------------------------------------------------------------
// #[wasm_bindgen] exported API
// -----------------------------------------------------------------------------

/// Initialise (or reset) the virtual file system.
/// If the map already exists it is dropped and a fresh empty one is created.
#[wasm_bindgen]
pub fn init_fs() {
    let mut guard = lock_fs();
    // Dropping the old Option (and its inner HashMap) frees memory immediately.
    *guard = Some(HashMap::new());
}

/// Write raw bytes into the virtual file system at the given path.
/// Overwrites any existing entry silently.
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

/// Return a clone of the bytes stored at `path`, or `None` if not found.
/// wasm-bindgen automatically marshals `Option<Vec<u8>>` ↔ `Uint8Array | null`.
#[wasm_bindgen]
pub fn read_file(path: &str) -> Option<Vec<u8>> {
    let guard = lock_fs();
    guard
        .as_ref()
        .and_then(|fs| fs.get(path).cloned())
}

/// Clear the entire virtual file system, freeing all memory immediately.
/// After this call the internal HashMap is empty (but still initialised so
/// subsequent `write_file` calls work without an explicit `init_fs`).
#[wasm_bindgen]
pub fn clear_fs() {
    let mut guard = lock_fs();
    let old = guard.take(); // extract the HashMap
    drop(old);              // explicit drop — returns all heap memory to the allocator
    *guard = Some(HashMap::new());
}

/// Return the number of files currently stored (useful for debugging / progress).
#[wasm_bindgen]
pub fn file_count() -> usize {
    let guard = lock_fs();
    guard
        .as_ref()
        .map(|fs| fs.len())
        .unwrap_or(0)
}

/// Return a JS array of all file paths (useful for debugging).
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
// Unit tests (run with: wasm-pack test --node)
// =============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    // wasm-bindgen test requires wasm_bindgen_test crate; these tests also run
    // under native `cargo test` when the target is not wasm.
    // We guard with a helper because wasm_bindgen_test_configure! is wasm-only.

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
        assert!(!has_file("a.txt"));
        // Ensure we can still write after clear
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
}
