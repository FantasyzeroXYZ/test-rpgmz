/* tslint:disable */
/* eslint-disable */

/**
 * Clear the entire virtual file system, freeing all memory immediately.
 */
export function clear_fs(): void;

/**
 * Return the number of files currently stored.
 */
export function file_count(): number;

/**
 * Return true if a file exists at `path`.
 */
export function has_file(path: string): boolean;

/**
 * Initialise (or reset) the virtual file system.
 * If the map already exists it is dropped and a fresh empty one is created.
 */
export function init_fs(): void;

/**
 * Return a JS array of all file paths.
 */
export function list_paths(): any[];

/**
 * Return raw bytes stored at `path`, or `None` if not found.
 */
export function read_file(path: string): Uint8Array | undefined;

/**
 * Return decrypted bytes if the file is RPGMV-encrypted, or raw bytes if not.
 * Accepts a 32-char hex encryption key. Returns `None` if file not found.
 *
 * This is the PREFERRED way to read encrypted assets — Rust performs the
 * XOR decryption and returns a clean `Vec<u8>` that JS can pass directly
 * to `new Blob()` without buffer compatibility issues.
 */
export function read_file_decrypted(path: string, hex_key: string): Uint8Array | undefined;

/**
 * Write raw bytes into the virtual file system at the given path.
 */
export function write_file(path: string, data: Uint8Array): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly clear_fs: () => void;
    readonly has_file: (a: number, b: number) => number;
    readonly init_fs: () => void;
    readonly list_paths: (a: number) => void;
    readonly read_file: (a: number, b: number, c: number) => void;
    readonly read_file_decrypted: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly write_file: (a: number, b: number, c: number, d: number) => void;
    readonly file_count: () => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
