const jwt = require('jsonwebtoken');
const genToken = userID => {
    return jwt.sign({uid: userID}, process.env.JWT_KEY, {expiresIn: 60*60*24*365}); //expires in 1 year
}
module.exports = genToken;