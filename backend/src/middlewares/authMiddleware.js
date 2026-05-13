const jwt = require ("jsonwebtoken");

const SECRET = "change_this_secret";

function authMiddleware (req, res, next){


    const authHeader = req.headers.authorization;


    if (!authHeader) {

        return res.status (401).json({
            
            message:"Token não fornecido"



        });
    }




  const token = authHeader.split(" ")[1];


   try {

    const decoded = jwt.verify(token, SECRET);

    req.user = decoded;
    next();




  } catch (error){

    return res.status(401).json({
        message:"Token invalido"
    });
  }


}


module.exports = authMiddleware;