INSERT INTO usuarios (nombre,email,password_hash,rol)
VALUES
('Administrador Demo','admin@demo.cl','$2a$10$ZI2oSr6QiW5ZWndZjUfVOOo3IV3gsXSkeSCO7/KxOxXf6iNoSNqiy','ADMIN'),
('Cliente Demo','cliente@demo.cl','$2a$10$ZI2oSr6QiW5ZWndZjUfVOOo3IV3gsXSkeSCO7/KxOxXf6iNoSNqiy','CLIENTE'),
('Usuario Demo','usuario@demo.cl','$2a$10$ZI2oSr6QiW5ZWndZjUfVOOo3IV3gsXSkeSCO7/KxOxXf6iNoSNqiy','USUARIO')
ON CONFLICT (email) DO NOTHING;

INSERT INTO estacionamientos
(cliente_id,nombre,direccion,latitud,longitud,precio_hora,cupo_maximo,cupos_disponibles)
SELECT id,'Parking Centro','Centro de Santiago',-33.4489,-70.6693,1500,25,25
FROM usuarios WHERE email='cliente@demo.cl'
AND NOT EXISTS (SELECT 1 FROM estacionamientos);

INSERT INTO tickets (estacionamiento_id,codigo_qr,patente,fecha_entrada,fecha_salida,estado,monto)
SELECT e.id,qr,patente,
       date_trunc('day',NOW()) + hora_entrada,
       CASE WHEN hora_salida IS NULL THEN NULL ELSE date_trunc('day',NOW()) + hora_salida END,
       estado,monto
FROM estacionamientos e
JOIN (VALUES
  ('QR-DEMO-1','AA1111','9 hours'::interval,'10 hours 30 minutes'::interval,'CERRADO',3000),
  ('QR-DEMO-2','BB2222','9 hours 15 minutes'::interval,'11 hours'::interval,'CERRADO',3000),
  ('QR-DEMO-3','CC3333','14 hours'::interval,'15 hours'::interval,'CERRADO',1500),
  ('QR-DEMO-4','DD4444','18 hours'::interval,'19 hours'::interval,'CERRADO',1500),
  ('QR-DEMO-5','EE5555','18 hours 10 minutes'::interval,NULL,'ACTIVO',NULL),
  ('QR-DEMO-6','FF6666','18 hours 20 minutes'::interval,NULL,'ACTIVO',NULL)
) AS demo(qr,patente,hora_entrada,hora_salida,estado,monto) ON true
WHERE e.nombre='Parking Centro'
AND NOT EXISTS (SELECT 1 FROM tickets);

INSERT INTO parametros_sistema (clave,valor,descripcion) VALUES
('comision_plataforma','10','Porcentaje que retiene la plataforma por ticket cobrado'),
('tarifa_hora_minima','1','Cantidad mínima de horas cobradas por ticket'),
('moneda','CLP','Moneda utilizada para mostrar precios')
ON CONFLICT (clave) DO NOTHING;
