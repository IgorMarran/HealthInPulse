const { Router } = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');

const router = Router();

// ─── validações reutilizáveis ────────────────────────────────

// Usuário: 3 a 30 caracteres, letras minúsculas sem acento, números, ponto e _
const usernameRule = body('username')
  .isString().bail()
  .trim().toLowerCase()
  .matches(/^[a-z0-9._]{3,30}$/)
  .withMessage('Usuário: de 3 a 30 caracteres, só letras sem acento, números, ponto e _');
const passwordRule = body('password').isLength({ min: 8 }).withMessage('Senha mínima de 8 caracteres');

// ─── rotas públicas ──────────────────────────────────────────

router.post(
  '/register',
  [
    usernameRule,
    passwordRule,
    body('fullName').isString().bail().trim().notEmpty().withMessage('Informe seu nome'),
  ],
  validate,
  authController.register,
);

router.post(
  '/login',
  [body('username').isString().bail().trim().notEmpty(), body('password').notEmpty()],
  validate,
  authController.login,
);

router.post('/refresh', authController.refresh);

// ─── rotas protegidas ────────────────────────────────────────

router.use(authenticate);

router.get('/me', authController.me);

router.post('/logout', authController.logout);

router.post('/tutorial-seen', authController.tutorialSeen);

router.post(
  '/change-password',
  [
    body('currentPassword').notEmpty(),
    passwordRule.withMessage('Nova senha mínima de 8 caracteres').bail().custom((val, { req }) => {
      if (val === req.body.currentPassword)
        throw new Error('Nova senha não pode ser igual à atual');
      return true;
    }),
  ],
  validate,
  authController.changePassword,
);

module.exports = router;
