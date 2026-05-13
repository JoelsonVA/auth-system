

const emailInput = document.getElementById("email");
const passworld= document.getElementById("password");
const btn = document.getElementById("btn");
const form = document.getElementById("loginForm");
btn.addEventListener ("click" ,async function(e){


     e.preventDefault();
    const email = emailInput.value;
    const password = document.getElementById("password").value;



    
if (email.value === "" || password.value === "" )
{
    alert ("preencha todos os campos");
    alert ("preencha todos os campos");
    return;
}

  if (!email.includes("@")){


        alert("Digite um email valido")
        return;
    }

    if (password.length < 8){

        alert("A senha precisa ter pelo menos 8 caracteres");

        return;


    }







    
    email.value = "";
    password.value = "";
    document.getElementById("email").focus();
    console.log(email);
    console.log(password);


    try {

        const response = await fetch (

            "http://localhost:3000/auth/login",

            {
                method : "POST",

                headers: {
                    "Content-Type": "application/json"
                },
            
            
              body: JSON.stringify({
                email, password
              })
            }





        );



        const data = await response.json();
        console.log(data);

        if(!response.ok){

            alert(data.message);

            return;
        }

        localStorage.setItem("token", data.token);

        alert("Login realizado com sucesso");




    } catch (error){


        console.log(error);
        alert("Erro no servidor");
    }

   



}); 