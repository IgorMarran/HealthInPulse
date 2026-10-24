const logger = require('../utils/logger');

// Erros de infraestrutura que não vêm com `status`: body-parser e multer.
// Sem isto viram 500 e, no caso do JSON inválido, ecoam um trecho do corpo.
const translate = (err) => {
  if (err.type === 'entity.parse.failed')  return { status: 400, message: 'JSON inválido' };
  if (err.type === 'entity.too.large')     return { status: 413, message: 'Corpo da requisição grande demais' };
  if (err.type === 'encoding.unsupported') return { status: 415, message: 'Codificação não suportada' };
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE')       return { status: 413, message: 'Arquivo grande demais' };
    if (err.code === 'LIMIT_UNEXPECTED_FILE') return { status: 400, message: 'Campo de arquivo inesperado' };
    return { status: 400, message: 'Upload inválido' };
  }
  return { status: err.status || 500, message: err.status ? (err.message || 'Erro') : 'Erro interno do servidor' };
};

const errorMiddleware = (err, req, res, _next) => {
  const { status, message } = translate(err);

  if (status >= 500) {
    logger.error({
      message: err.message,
      stack:  err.stack,
      path:   req.path,
      method: req.method,
      user:   req.user?.id,
    });
  }

  res.status(status).json({
    error:   message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack, detail: err.message }),
  });
};

module.exports = errorMiddleware;
