import {Router} from 'express';
import {login,logout,register,me,forgotPassword,resetPassword} from '../controllers/auth.controller.js';
import {auth} from '../middleware/auth.middleware.js';
import {validateBody} from '../middleware/validate.middleware.js';
import {authLimiter} from '../middleware/rateLimit.middleware.js';
import {loginSchema,registerSchema,forgotPasswordSchema,resetPasswordSchema} from '../validation/auth.schema.js';
const r=Router();
r.post('/login',authLimiter,validateBody(loginSchema),login);
r.post('/register',authLimiter,validateBody(registerSchema),register);
r.get('/me',auth,me);
// Sin auth ni límite: da igual si ya expiró o nunca existió, solo borra la cookie del navegador.
r.post('/logout',logout);
r.post('/forgot-password',authLimiter,validateBody(forgotPasswordSchema),forgotPassword);
r.post('/reset-password',authLimiter,validateBody(resetPasswordSchema),resetPassword);
export default r;
