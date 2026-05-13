const cors = require("cors");
const express = require("express");
const app = express();
const authMiddleware = require("./middlewares/authMiddleware");
const authRoutes = require ("./routes/authRoutes");


app.use(express.json());

app.use(cors());


app.get("/", (req, res) => {
    res.send("API rodando!");
});



app.get("/dashboard", authMiddleware,(req, res)=>{

  return res.json({
    message:"Bem vindos ao dashboard", user:req.user
   });

});

app.use("/auth", authRoutes);



app.listen(3000, () => { 
    console.log("Servidor rodando na porta 3000")
});

require("./config/db");


app.listen(3000, () => {

    console.log("Servidor rodando na porta 3000");


});

