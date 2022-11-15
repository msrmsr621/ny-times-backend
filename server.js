const fs = require('fs')
const bodyParser = require('body-parser')
const jsonServer = require('json-server')
const jwt = require('jsonwebtoken')
var http = require('http');

const server = jsonServer.create()
const router = jsonServer.router('./database.json')
const userdb = JSON.parse(fs.readFileSync('./users.json', 'UTF-8'))

server.use(bodyParser.urlencoded({extended: true}))
server.use(bodyParser.json())
server.use(jsonServer.defaults());
server.use(/^(?!\/auth).*$/,  (req, res, next) => {
  console.log(req.headers.authorization)
  const token = req.headers.authorization.split(' ')[0] == 'Bearer';
  console.log("token------> ", token);
  // decode token
  if (token) {

    let verifyTokenResult;
     verifyTokenResult = verifyToken(req.headers.authorization.split(' ')[1]);

     if (verifyTokenResult instanceof Error) {
       const status = 401
       const message = 'Invalid Access Token'
       res.status(status).json({status, message})
       return
     }
      next();
  } else {
    // if there is no token
    // return an error
    return res.status(403).send({
        "error": true,
        "message": 'No token provided.'
    });
  }
})

const SECRET_KEY = '123456789'

const expiresIn = '1h'

const nytimesApiKey = "0yKh39tYFbWxVyaDsyjiQIiGLj9CARmD";
const host = 'api.nytimes.com';

// const secret =  "some-secret-shit-goes-here";
const refreshTokenSecret =  "some-secret-refresh-token-shit";
const tokenLife =  900;
const refreshTokenLife = 86400;
const tokenList = {}

// Create a token from a payload 
function createToken(payload){
  return jwt.sign(payload, SECRET_KEY, { expiresIn: tokenLife});

}

// Create a token from a payload 
function createRefreshToken(payload){
  return jwt.sign(payload, refreshTokenSecret, { expiresIn: refreshTokenLife});
  
}

// Verify the token 
function verifyToken(token){
  return  jwt.verify(token, SECRET_KEY, (err, decode) => decode !== undefined ?  decode : err)
}

// Check if the user exists in database
function isAuthenticated({email, password}){
  console.log("userdb ", userdb.users);
  return userdb.users.findIndex(user => user.email === email && user.password === password) !== -1
}

// Register New User
server.post('/auth/register', (req, res) => {
  console.log("register endpoint called; request body:");
  console.log(req.body);
  const {email, password} = req.body;

  if(isAuthenticated({email, password}) === true) {
    const status = 401;
    const message = 'Email and Password already exist';
    res.status(status).json({status, message});
    return
  }

  fs.readFile("./users.json", (err, data) => {  
    if (err) {
      const status = 401
      const message = err
      res.status(status).json({status, message})
      return
    };

    // Get current users data
    var data = JSON.parse(data.toString());

    // Get the id of last user
    var last_item_id = data.users[data.users.length-1].id;

    //Add new user
    data.users.push({id: last_item_id + 1, email: email, password: password}); //add some data
    var writeData = fs.writeFile("./users.json", JSON.stringify(data), (err, result) => {  // WRITE
        if (err) {
          const status = 401
          const message = err
          console.log("final_resp ", {status, message});
          res.status(status).json({status, message})
          return
        }
    });

});

// Create token for new user
  const access_token = createToken({email, password})
  console.log("Access Token:" + access_token);
  res.status(200).json({access_token})
})

// Login to one of the users from ./users.json
server.post('/auth/login', (req, res) => {
  console.log("login endpoint called; request body:");
  console.log(req.body);
  const {email, password} = req.body;
  if (isAuthenticated({email, password}) === false) {
    const status = 401
    const message = 'Incorrect email or password'
    res.status(status).json({status, message})
    return
  }
  const access_token = createToken({email, password});
  const refreshToken = createRefreshToken({email, password});
  console.log("Access Token:" + access_token);
  const response = {access_token, "refreshToken": refreshToken,};
  tokenList[refreshToken] = response
  res.status(200).json(response);
});

server.post('/auth/token', (req,res) => {
    // refresh the damn token
    const postData = req.body
    // if refresh token exists
    if((postData.refreshToken) && (postData.refreshToken in tokenList)) {
        const user = {
            "email": postData.email,
            "name": postData.name
        }
        const token = jwt.sign(user, config.secret, { expiresIn: config.tokenLife})
        const response = {
            "token": token,
        }
        // update the token in the list
        tokenList[postData.refreshToken].token = token
        res.status(200).json(response);        
    } else {
        res.status(404).send('Invalid request')
    }
})


server.get('/nytimes/topstories', (req, res) => {
  console.log("topstories endpoint called; request body:");
  
  const {article} = req.query;
  // console.log("article--> ", req)
  var request = http.request({
    host: host,
    path: "/svc/topstories/v2/"+article+".json?api-key="+nytimesApiKey,
    method: 'GET',
    headers: {
      // headers such as "Cookie" can be extracted from req object and sent to /test
    }
  }, function(response) {
    var data = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      data += chunk;
    });
    response.on('end', () => {
      res.status(200).json(JSON.parse(data))
    });
  });
  request.end();  
})


server.get('/nytimes/articlesearch', (req, res) => {
  console.log("articlesearch endpoint called; request body:");
  console.log("page_no ", req)
  const query = req.query.query;
  const page_no = parseInt(req.query.page_no);
  
  console.log("query--> ", query);
  console.log("page_no--> ", page_no);
  

    let history_data = [];
    fs.readFile("./search_history.json", (err, data) => {  
      if (err) {
        
      };

      // Get current histroy data
      history_data = JSON.parse(data.toString());

      if(query){
        if (history_data.length == 5) {
        history_data.pop();
        history_data.push()
        history_data.splice(0, 0, query);
        console.log("history_data ", history_data);
      }
      else {

        const old_data = JSON.parse(JSON.stringify(history_data));
        old_data.splice(0, 0, query);
        history_data = old_data;
        console.log("temp_arr ", history_data);
        // arr.splice(to, 0, cutOut); 
      }

      //Add new user
      // history_data.push(query); 
      var writeData = fs.writeFile("./search_history.json", JSON.stringify(history_data), (err, result) => {  // WRITE
          if (err) {
            
          }});
      }

    });
  

  var request = http.request({
    host: host,
    path: encodeURI("/svc/search/v2/articlesearch.json?page="+page_no+"&q="+query+"&api-key="+nytimesApiKey),
    method: 'GET',
    headers: {
      // headers such as "Cookie" can be extracted from req object and sent to /test
    }
  }, function(response) {
    let rep_data = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      rep_data += chunk;
    });
    response.on('end', () => {
      console.log("history_data ", history_data)
      let final_resp = {history_data: history_data, artcile_search_list:JSON.parse(rep_data)};
      // console.log("rep_data--> ", final_resp);
      res.status(200).json(final_resp);
    });
  });
  request.end();  
})

server.get('/nytimes/historysearch', (req, res) => {
  console.log("historysearch endpoint called;");

  fs.readFile("./search_history.json", (err, data) => {  
    if (err) {
      
    };

    // Get current histroy data
    let history_data = data.toString();
    res.status(200).json(history_data)

  });
   
})



server.use(router);

server.listen(8000, () => {
  console.log('Run Auth API Server')
})