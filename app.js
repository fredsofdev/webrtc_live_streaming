const express  = require('express');
const app = express();


const PORT = 5000;


app.set('views', __dirname + '/janus-demos');
app.engine('html',require('ejs').renderFile);
app.set('view engine', 'html');
app.use(express.static('public'));

app.get('/',(req, res)=>{
    res.render('streamingtest.html');
});


app.listen(PORT, ()=>{
    console.log(`App is listening on port ${PORT} !`);
});