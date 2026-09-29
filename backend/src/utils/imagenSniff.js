// El nombre del tipo en un data URI ("data:image/png;base64,...") lo elige quien lo manda: no
// prueba nada sobre el contenido real. Esto compara los primeros bytes decodificados contra la
// firma real de cada formato, para no aceptar un archivo cualquiera solo porque alguien lo
// etiquetó como imagen.
const FIRMAS = {
  png: buf => buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpeg: buf => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  webp: buf => buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP'
};

// tipoDeclarado: 'png' | 'jpg' | 'jpeg' | 'webp' (tal como aparece en el data URI, sin normalizar).
export function coincideConTipoDeclarado(dataUri, tipoDeclarado) {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  let buf;
  try { buf = Buffer.from(base64.slice(0, 64), 'base64'); } catch { return false; }
  const clave = tipoDeclarado === 'jpg' ? 'jpeg' : tipoDeclarado;
  const firma = FIRMAS[clave];
  return !!firma && firma(buf);
}
