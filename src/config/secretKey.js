const env = require('./env');

module.exports = {
    secretKey: env.JWT_SECRET_KEY,
    accessTokenOption: {
        "algorithm": "HS256",
        "expiresIn": "1h",
        "issuer": "ehdtjs.com"
    },
    refreshTokenOption: {
        "algorithm": "HS256",
        "expiresIn": "14d",
        "issuer": "ehdtjs.com"
    }
}