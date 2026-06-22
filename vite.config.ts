import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {

    // GitHub Pages 配置关键：base 必须设置为 '/仓库名/'
    // 如果你的访问地址是 https://用户名.github.io/my-repo/，则 base 为 '/my-repo/'
    base: '/test-rpgmz/',

    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // 允许 Vite 开发服务器访问项目根目录的 pkg/ 和 wasm_vfs.js（WASM 模块依赖）
      fs: {
        allow: [
          // 当前项目
          path.resolve(__dirname, '.'),
          // 上级目录（旧项目的 pkg/ 和 wasm_vfs.js）
          path.resolve(__dirname, '..'),
        ],
      },
    },
    build: {
      rollupOptions: {
        external: [],
      },
    },
  };
});
