const email = document.getElementById("email")
const passworld= document.getElementById("password")
const btn = document.getElementById("btn")
btn.addEventListener ("click" , function(){


    
if (email.value === "" || password.value === "" )
{
    console.log ("preencha todos os campos");
    window.alert ("preencha todos os campos")
    return;
}



    console.log("Login feito com sucesso")
    alert("Login feito com sucesso")
    email.value = "";
    password.value = "";
    email.focus();




});