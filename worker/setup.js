/*
 * server/*-г ачаалахаас ӨМНӨ ажиллана (worker/index.js-д хамгийн эхэнд import хийгдэнэ):
 *   • DB pool-ыг хүсэлт бүрт тусад нь өгөх AsyncLocalStorage
 *   • migration-ууд (fs байхгүй тул build үед үүсгэсэн migrations.gen.js-ээс)
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import migrations from './migrations.gen.js';

export const scope = new AsyncLocalStorage();
globalThis.__SOKH_DB_SCOPE = scope;
globalThis.__SOKH_MIGRATIONS = migrations;
