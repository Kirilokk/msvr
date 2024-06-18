'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

let reflection;
let Convergence = 800;
let EyeSeparation = 100;
let fov = 1;
let NearClippingDistance = 1;

let R1 = 0.35;                   // Radius of smaller cylinder
let R2 = 3 * R1;                // Radius of bigger cylinder
let b =  3 * R1;                // Height of the surface
let stepAlpha = 0.1;             // Step for alpha
let stepBeta = 0.1;               // Step for beta

// Degree to Radian
function deg2rad(angle) {
    return angle * Math.PI / 180;
}

// Update parameters on user change
function setParameters(ConNew, SepNew, FovNew, NcdNew){
    Convergence = ConNew; 
    EyeSeparation = SepNew;
    fov = FovNew;
    NearClippingDistance = NcdNew;

    reflection.mConvergence = ConNew;
    reflection.mEyeSeparation = SepNew;
    reflection.mFOV = FovNew;
    reflection.mNearClippingDistance = NcdNew;

}

function updateHtml(con, sep, fov, ncd){
    document.getElementById("ConCurrent").textContent = con;
    document.getElementById("SepCurrent").textContent = sep;
    document.getElementById("FovCurrent").textContent = fov;
    document.getElementById("NcdCurrent").textContent = ncd;

    document.getElementById("paramConv").value = con;
    document.getElementById("paramSep").value = sep;
    document.getElementById("paramFov").value = fov;
    document.getElementById("paramNcd").value = ncd;
}

function setDefault() {
    const Convergence = 800;
    const EyeSeparation = 100;
    const fov = 1;
    const NearClippingDistance = 1;

    setParameters(Convergence, EyeSeparation, fov, NearClippingDistance);
    updateHtml(Convergence, EyeSeparation, fov, NearClippingDistance);
    draw();
}


function updateParameters() {
    const conv = parseFloat(document.getElementById("paramConv").value);
    const sep = parseFloat(document.getElementById("paramSep").value);
    const fov = parseFloat(document.getElementById("paramFov").value);
    const ncd = parseFloat(document.getElementById("paramNcd").value);
    

    setParameters(conv, sep, fov, ncd);
    updateHtml(conv, sep, fov, ncd);
    draw();
}


function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iTexCoordBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function (vertices, textures) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textures), gl.STREAM_DRAW);

        this.count = vertices.length / 3;
    }

    this.Draw = function() {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexCoord);
        
        gl.drawArrays(gl.LINES, 0, this.count);
    }
}

function StereoCamera(
    Convergence,
    EyeSeparation,
    AspectRatio,
    FOV,
    NearClippingDistance,
    FarClippingDistance
) {
    this.mConvergence = Convergence;
    this.mEyeSeparation = EyeSeparation;
    this.mAspectRatio = AspectRatio;
    this.mFOV = FOV;
    this.mNearClippingDistance = NearClippingDistance;
    this.mFarClippingDistance = FarClippingDistance;
    this.mProjectionMatrix;
    this.mModelViewMatrix;

    this.ApplyLeftFrustum = function () {
        let top, bottom, left, right;

        top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
        bottom = -top;

        const a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;

        const b = a - this.mEyeSeparation / 2;
        const c = a + this.mEyeSeparation / 2;

        left = -b * this.mNearClippingDistance / this.mConvergence;
        right = c * this.mNearClippingDistance / this.mConvergence;

        this.mProjectionMatrix = m4.frustum(left, right, bottom, top, this.mNearClippingDistance, this.mFarClippingDistance)
        this.mModelViewMatrix = m4.identity()

        m4.multiply(m4.translation(0.01 * this.mEyeSeparation / 2, 0.0, 0.0), this.mModelViewMatrix, this.mModelViewMatrix);
    }

    this.ApplyRightFrustum = function () {
        let top, bottom, left, right;

        top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
        bottom = -top;

        const a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;

        const b = a - this.mEyeSeparation / 2;
        const c = a + this.mEyeSeparation / 2;

        left = -c * this.mNearClippingDistance / this.mConvergence;
        right = b * this.mNearClippingDistance / this.mConvergence;

        this.mProjectionMatrix = m4.frustum(left, right, bottom, top, this.mNearClippingDistance, this.mFarClippingDistance)
        this.mModelViewMatrix = m4.identity()

        m4.multiply(m4.translation(-0.01 * this.mEyeSeparation / 2, 0.0, 0.0), this.mModelViewMatrix, this.mModelViewMatrix);
    }
}

function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iColor = -1;

    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function draw() {
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    let projection = m4.orthographic(-3, 3, -3, 3, -3, 3);

    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-5);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );

    gl.uniform4fv(shProgram.iColor, [0, 1, 0, 1]);

    let modelViewProjection = m4.multiply(projection, matAccum1 );

    reflection.ApplyLeftFrustum()
    modelViewProjection = m4.multiply(reflection.mProjectionMatrix, m4.multiply(reflection.mModelViewMatrix, matAccum1));

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);

    gl.colorMask(true, false, false, false);

    surface.Draw();

    gl.clear(gl.DEPTH_BUFFER_BIT);

    reflection.ApplyRightFrustum()
    modelViewProjection = m4.multiply(reflection.mProjectionMatrix, m4.multiply(reflection.mModelViewMatrix, matAccum1));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.colorMask(false, true, true, false);
    surface.Draw();
    gl.colorMask(true, true, true, true);
}

// Function to calculate X surface coordinate
function getX (alpha, beta){
    let r = ( R2 - R1 ) * Math.pow(Math.sin(deg2rad(( 180 * alpha ) / (4 * b))),2) + R1; 
    return r * Math.cos(deg2rad(beta));
}

// Function to calculate Y surface coordinate
function getY (alpha, beta){
    let r = ( R2 - R1 ) * Math.pow(Math.sin(deg2rad(( 180 * alpha ) / (4 * b))),2) + R1; 
    return r * Math.sin(deg2rad(beta))
}

// Function to calculate Z surface coordinate
function getZ(alpha){
    return alpha;
}

// Partial derivatives for U
function getDerivativeU(u, v, x, y, z, delta){
    let dx_du = (getX(u + delta, v) - x) / deg2rad(delta);  
    let dy_du = (getY(u + delta, v) - y) / deg2rad(delta);
    let dz_du = (getZ(u + delta, v) - z) / deg2rad(delta);

    return [dx_du, dy_du, dz_du];
}

// Partial derivatives for V
function getDerivativeV(u, v, x, y, z, delta){
    let dx_dv = (getX(u, v + delta) - x) / deg2rad(delta);  
    let dy_dv = (getY(u, v + delta) - y) / deg2rad(delta);
    let dz_dv = (getZ(u, v + delta) - z) / deg2rad(delta);

    return [dx_dv, dy_dv, dz_dv];
}
function CreateSurfaceData()
{
    let vertexList = [];
    let texCoordList = [];
    let x = 0
    let y = 0
    let z = 0
    let delta = 0.0001
    // Ranges:
    // 0 <= alpha(i) <= 2b
    // 0 <= beta(j) <= 2PI
    for (let i = 0;  i <= 2 * b;  i+= stepAlpha) {
        for (let j = 0; j <= 360; j+=stepBeta){

            x = getX(i, j);
            y = getY(i, j);
            z = getZ(i);
            let derU = getDerivativeU(i, j, x, y, z, delta);
            let derV = getDerivativeV(i, j, x, y, z, delta);
            
            vertexList.push(x, y, z);
            texCoordList.push(i / (2 * b), j / 360);

            x = getX(i + 0.1, j);
            y = getY(i + 0.1, j);
            z = getZ(i + 0.1);
            derU = getDerivativeU(i + 0.1, j, x, y, z, delta);
            derV = getDerivativeV(i + 0.1, j, x, y, z, delta);
            
            vertexList.push(x, y, z);
            texCoordList.push((i + 0.1) / (2 * b), j / 360);
        }
    }

    return [vertexList, texCoordList];  
}

function animating() {
    window.requestAnimationFrame(animating)
    draw()
}


function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribTexCoord = gl.getAttribLocation(prog, "texture");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor = gl.getUniformLocation(prog, "color");

    reflection = new StereoCamera(Convergence, EyeSeparation, 1, fov, NearClippingDistance, 50)

    surface = new Model('Surface');
    surface.BufferData(...CreateSurfaceData());
    gl.enable(gl.DEPTH_TEST);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

function init() {

    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);
    
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const textureImage = new Image();
    textureImage.crossOrigin = 'anonymus';
    
    textureImage.src = "https://raw.githubusercontent.com/mdn/dom-examples/main/webgl-examples/tutorial/sample6/cubetexture.png";
    textureImage.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            textureImage
        );
        draw()
    }

    animating();
}