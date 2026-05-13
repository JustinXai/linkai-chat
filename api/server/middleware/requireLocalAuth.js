const passport = require('passport');
const { logger } = require('@librechat/data-schemas');
const { recordLoginFailure } = require('~/server/middleware/rateLimitMiddleware');

const requireLocalAuth = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      logger.error('[requireLocalAuth] Error at passport.authenticate:', err);
      return next(err);
    }
    if (!user) {
      // 登录失败，记录失败次数
      if (req.body?.email) {
        recordLoginFailure(req.body.email);
      }
      logger.debug('[requireLocalAuth] Error: No user');
      return res.status(404).send(info);
    }
    if (info && info.message) {
      // 登录失败，记录失败次数
      if (req.body?.email) {
        recordLoginFailure(req.body.email);
      }
      logger.debug('[requireLocalAuth] Error: ' + info.message);
      return res.status(422).send({ message: info.message });
    }
    req.user = user;
    next();
  })(req, res, next);
};

module.exports = requireLocalAuth;
