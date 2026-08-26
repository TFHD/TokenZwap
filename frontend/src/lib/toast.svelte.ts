import { browser } from '$app/environment';
import type { Toast, ToastKind } from './types';

const MAX_TOASTS = 5;
const TTL_MS = 5500;

let seq = 0;

export const toasts = $state<Toast[]>([]);

export function pushToast(
	kind: ToastKind,
	title: string,
	message?: string,
	href?: string
) {
	const id = ++seq;
	toasts.unshift({ id, kind, title, message, href });
	if (toasts.length > MAX_TOASTS) toasts.length = MAX_TOASTS;
	if (browser) {
		window.setTimeout(() => dismissToast(id), TTL_MS);
	}
}

export function dismissToast(id: number) {
	const index = toasts.findIndex((toast) => toast.id === id);
	if (index >= 0) toasts.splice(index, 1);
}
