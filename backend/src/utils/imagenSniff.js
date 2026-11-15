// El nombre del tipo en un data URI ("data:image/png;base64,...") lo elige quien lo manda: no
// prueba nada sobre el contenido real. Esto compara los primeros bytes decodificados contra la
// firma real de cada formato, para no aceptar un archivo cualquiera solo porque alguien lo
// etiquetó como imagen.
// Además de la firma inicial se revisa la estructura mínima de cada formato (el bloque IHDR y el
// cierre IEND del PNG, el fin de imagen del JPEG, el largo declarado del WebP): copiar solo los
// primeros bytes de una imagen delante de otro contenido (un archivo "políglota") ya no basta.
const PNG_FIN = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const FIRMAS = {
  png: (ini, fin) => ini.length >= 16 && ini.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    && ini.toString('ascii', 12, 16) === 'IHDR' && fin.subarray(-12).equals(PNG_FIN),
  jpeg: (ini, fin) => ini.length >= 3 && ini[0] === 0xff && ini[1] === 0xd8 && ini[2] === 0xff
    && fin.length >= 2 && fin[fin.length - 2] === 0xff && fin[fin.length - 1] === 0xd9,
  webp: (ini, fin, total) => ini.length >= 12 && ini.toString('ascii', 0, 4) === 'RIFF' && ini.toString('ascii', 8, 12) === 'WEBP'
    && ini.readUInt32LE(4) + 8 === total
};

// tipoDeclarado: 'png' | 'jpg' | 'jpeg' | 'webp' (tal como aparece en el data URI, sin normalizar).
export function coincideConTipoDeclarado(dataUri, tipoDeclarado) {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1).replace(/\s/g, '');
  if (base64.length < 24 || base64.length % 4 !== 0) return false;
  const ini = Buffer.from(base64.slice(0, 64), 'base64');
  const fin = Buffer.from(base64.slice(-24), 'base64');
  const total = base64.length / 4 * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  const clave = tipoDeclarado === 'jpg' ? 'jpeg' : tipoDeclarado;
  const firma = FIRMAS[clave];
  return !!firma && firma(ini, fin, total);
}
