const mysql = require("mysql2");


const connection = mysql.createConnection({

    host: "localhost",
    user: "auth_user",
    password: "123456",
    database: "auth_db"

});


connection.connect((err)=>{

if (err) {
    console.log("Erro ao conectar ao MySQL:", err);
} else {
    console.log("Conectado ao MySQL!");
}


});

module.exports = connection;