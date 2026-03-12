const jwt = require("jsonwebtoken")

module.exports = (req, res, next) =>{
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader){
            return res.status(401).send({success:false, 
            message:"Authorization header missing. Please include 'Authorization: Bearer <token>' in your request"})
        }

        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).send({success:false, 
            message:"Invalid authorization format. Use 'Bearer <token>'"})
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).send({success:false, 
            message:"Token missing from authorization header"})
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;// contains {userId: user_id}

        next()

    } catch (error) {
        return res.status(401).send({success:false, 
        message:"Invalid token", error:error.message})
    }
}