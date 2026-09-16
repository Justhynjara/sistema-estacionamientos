import { describe, test, expect, vi, afterEach } from 'vitest';
import { redirectToWebpay } from './webpay.js';

describe('redirectToWebpay', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  test('crea y envía un formulario POST con el token_ws hacia la URL de Webpay', () => {
    const submitSpy = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});

    redirectToWebpay('https://webpay.test/init', 'token-abc-123');

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    expect(form.method).toBe('post');
    expect(form.action).toBe('https://webpay.test/init');

    const input = form.querySelector('input[name="token_ws"]');
    expect(input).not.toBeNull();
    expect(input.type).toBe('hidden');
    expect(input.value).toBe('token-abc-123');

    expect(submitSpy).toHaveBeenCalledTimes(1);
  });
});
