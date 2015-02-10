    var SignaturePad = (function (document) {
        "use strict";

        var SignaturePad = function (canvas, options) {
            var self = this,
                opts = options || {};

            this.velocityFilterWeight = opts.velocityFilterWeight || 0.7;
            this.minWidth = opts.minWidth || 0.5;
            this.maxWidth = opts.maxWidth || 2.5;
            this.dotSize = opts.dotSize || function () {
                return (this.minWidth + this.maxWidth) / 2;
            };
            this.penColor = opts.penColor || "black";
            this.backgroundColor = opts.backgroundColor || "rgba(0,0,0,0)";
            this.onEnd = opts.onEnd;
            this.onBegin = opts.onBegin;

            this._canvas = canvas;
            this._ctx = canvas.getContext("2d");
            this.clear();

            this.historyStack = [];
            this.forwardStack = [];

            if(!opts.showOnly) {
                this._handleMouseEvents();
                this._handleTouchEvents();
            }
        };

        SignaturePad.prototype.getScale = function(){
            return this._canvas.width / this._canvas.clientWidth;
        };

        // 自定义事件
        var EmitMyEvent = function(type, detail){
            this.init(type, detail)
        }

        EmitMyEvent.prototype.init = function(type, detail){
            var evt = new CustomEvent (type, {detail: detail});
            document.dispatchEvent (evt);
        }

        SignaturePad.prototype.clear = function () {
            var ctx = this._ctx,
                canvas = this._canvas;

            ctx.fillStyle = this.backgroundColor;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            this._reset();
        };

        SignaturePad.prototype.toDataURL = function (imageType, quality) {
            var canvas = this._canvas;
            return canvas.toDataURL.apply(canvas, arguments);
        };

        SignaturePad.prototype.fromDataURL = function (dataUrl) {
            var self = this,
                image = new Image(),
                ratio = window.devicePixelRatio || 1,
                width = this._canvas.width / ratio,
                height = this._canvas.height / ratio;

            this._reset();
            image.src = dataUrl;
            image.onload = function () {
                self._ctx.drawImage(image, 0, 0, width, height);
            };
            this._isEmpty = false;
        };

        SignaturePad.prototype._strokeUpdate = function (tPoint) {

            var point = this._createPoint({x: tPoint[1], y: tPoint[2], t: tPoint[3]});
            this._addPoint(point);
        };

        SignaturePad.prototype._strokeBegin = function (tPoint) {
            this._reset();
            this._strokeUpdate(tPoint);
        };

        SignaturePad.prototype._strokeDraw = function (point) {
            var ctx = this._ctx,
                dotSize = typeof(this.dotSize) === 'function' ? this.dotSize() : this.dotSize;

            ctx.beginPath();
            this._drawPoint(point.x, point.y, dotSize);
            ctx.closePath();
            ctx.fill();
        };

        SignaturePad.prototype._strokeEnd = function () {
            var canDrawCurve = this.points.length > 2,
                point = this.points[0];

            if (!canDrawCurve && point) {
                this._strokeDraw(point);
            }
        };

        SignaturePad.prototype._handleMouseEvents = function () {
            var self = this;
            this._mouseButtonDown = false;

            this._canvas.addEventListener("mousedown", function (event) {
                if (event.which === 1) {
                    self._mouseButtonDown = true;
                    self._strokeBegin(self._transformCoordinate(event, 0));
                }
            });

            this._canvas.addEventListener("mousemove", function (event) {
                if (self._mouseButtonDown) {
                    self._strokeUpdate(self._transformCoordinate(event, 1));
                }
            });

            document.addEventListener("mouseup", function (event) {
                if (event.which === 1 && self._mouseButtonDown) {
                    self._mouseButtonDown = false;
                    self._strokeEnd(self._transformCoordinate(event, 2));
                }
            });
        };

        SignaturePad.prototype._handleTouchEvents = function () {
            var self = this;
            // Pass touch events to canvas element on mobile IE.
            this._canvas.style.msTouchAction = 'none';

            this._canvas.addEventListener("touchstart", function (event) {
                var touch = event.changedTouches[0];
                    touch.timeStamp = event.timeStamp;
                self._strokeBegin(self._transformCoordinate(touch, 0));
            });

            this._canvas.addEventListener("touchmove", function (event) {
                // Prevent scrolling.
                event.preventDefault();

                var touch = event.changedTouches[0];
                    touch.timeStamp = event.timeStamp;
                self._strokeUpdate(self._transformCoordinate(touch, 1));
            });

            document.addEventListener("touchend", function (event) {
                var wasCanvasTouched = event.target === self._canvas;
                if (wasCanvasTouched) {
                    self._strokeEnd(self._transformCoordinate(event, 2));
                }
            });
        };


        /**
         * 输入单点
         * @param  {数组} point [type,x,y]
         */
        SignaturePad.prototype._handlePointInput = function(point){
            var self =this;

            if(point[0] == 0){
                self._strokeBegin(point);
                return;
            }
            else if(point[0] == 1){
                self._strokeUpdate(point);
                return;
            }
            else if(point[0] == 2) {
                self._strokeEnd(point);
                return;
            }
        };


        //播放器对象
        var player = {
            stop: function(){
                var self = this;
                clearInterval(self.id);
            }
        };

        /**
         * 播放路径
         * @param  {序列化的三维字符串或者三维数组对象} pointsInput 
         * @param  {播放时帧间距} delay       不设定就直接播放
         */
        SignaturePad.prototype.play = function (pointsInput,delay) {
            if(typeof pointsInput !== 'object') return false;
            var self = this;
            self._reset();

            if(player.id){
                self.clear();
                player.stop();
            }
            player.id = new Date().getTime();

            //如果输入的是字符串（从外部下载）就转换为正常字符
            if(typeof pointsInput === 'string'){
                // 将输入的序列化的三维数组对象字符串转换成对象
                self.historyStack = JSON.parse(pointsInput);

                var thePoints = self.shiftArrayInput(self.historyStack);

            }
            //如果输入的是三维数组形式的历史记录，就在此转换成二维数组
            else {
                self.historyStack = pointsInput;
                var thePoints = self.shiftArrayInput(pointsInput);
            }

            if(typeof delay === 'undefined' || delay == 0){
                for(var i=0,l=thePoints.length; i<l; i++){
                    self._handlePointInput(thePoints[i]);
                }
                new EmitMyEvent('draw.play.end',{id: player.id, message: '播放完毕!'});
            }
            else {
                var i=0,l=thePoints.length;
                self._canvas.style.pointerEvents = 'none';
                player.id = setInterval(function(){
                    if(i<l){
                        self._handlePointInput(thePoints[i]);
                        i++;
                    }
                    else {
                        self._canvas.style.pointerEvents = '';
                        player.stop();

                        new EmitMyEvent('draw.play.end',{id: player.id, message: '播放完毕!'});
                    }
                },delay);
            }
            return player;
        };

        SignaturePad.prototype.isEmpty = function () {
            return this._isEmpty;
        };

        SignaturePad.prototype._reset = function () {
            this.points = [];
            this._lastVelocity = 0;
            this._lastWidth = (this.minWidth + this.maxWidth) / 2;
            this._isEmpty = true;
            this._ctx.fillStyle = this.penColor;
        };

        /**
         * changed
         */
        SignaturePad.prototype._createPoint = function (point) {
            return new Point(point.x,point.y,point.t);
        };

        /**
         * 获取当前书写的内容
         * @return {字符串} 记录路径的字符串
         */
        SignaturePad.prototype.getPath = function () {
            return JSON.stringify(this.historyStack);
        };

        /**
         * 后退
         */
        SignaturePad.prototype.undo = function (){
            var self = this;
            if(self.historyStack.length !== 0){
                var item = self.historyStack.pop();
                self.forwardStack.push(item);
            }
            else {
                new EmitMyEvent('draw.error','无法撤销！');
            }
            self.clear();
            self.play(this.historyStack);
        };
        /**
         * 前进
         */
        SignaturePad.prototype.redo = function (){
            if(this.forwardStack.length !== 0){
                var item = this.forwardStack.pop();
                this.historyStack.push(item);
            }
            else {
                new EmitMyEvent('draw.error','无法重做！');
            }
            this.clear();
            this.play(this.historyStack);
        };

        /**
         * 清除画布
         */
        SignaturePad.prototype.reset = function () {
            this.historyStack = this.forwardStack = [];
            this.clear();
        }

        /**
         * 将历史堆栈里的三维数组变成二维数组，可以使用play方法进行回放
         */
        SignaturePad.prototype.shiftArrayInput = function (stack){
            if(typeof stack !== 'object') return false;
            var temp = [];
            for(var i=0,l=stack.length; i<l; i++){
                temp = temp.concat(stack[i]);
            }
            return temp;
        };

        var _draws = [];

        /**
         * my  所有时间的传递到此终止,在此处理历史记录
         */
        SignaturePad.prototype._transformCoordinate = function (event, type) {
            var rect = this._canvas.getBoundingClientRect();
            var x = parseInt((event.clientX - rect.left)*this.getScale());
            var y = parseInt((event.clientY - rect.top)*this.getScale());
            var point = [type, x, y, event.timeStamp];

            this.forwardStack = [];//清空前进历史
            _draws.push(point);
            if(type === 2) {
                this.historyStack.push(_draws);
                _draws = [];
            }

            return point;
        };

        SignaturePad.prototype._addPoint = function (point) {
            var points = this.points,
                c2, c3,
                curve, tmp;

            points.push(point);

            if (points.length > 2) {
                // To reduce the initial lag make it work with 3 points
                // by copying the first point to the beginning.
                if (points.length === 3) points.unshift(points[0]);

                tmp = this._calculateCurveControlPoints(points[0], points[1], points[2]);
                c2 = tmp.c2;
                tmp = this._calculateCurveControlPoints(points[1], points[2], points[3]);
                c3 = tmp.c1;
                curve = new Bezier(points[1], c2, c3, points[2]);
                this._addCurve(curve);

                // Remove the first element from the list,
                // so that we always have no more than 4 points in points array.
                points.shift();
            }
        };

        SignaturePad.prototype._calculateCurveControlPoints = function (s1, s2, s3) {
            var dx1 = s1.x - s2.x, dy1 = s1.y - s2.y,
                dx2 = s2.x - s3.x, dy2 = s2.y - s3.y,

                m1 = {x: (s1.x + s2.x) / 2.0, y: (s1.y + s2.y) / 2.0},
                m2 = {x: (s2.x + s3.x) / 2.0, y: (s2.y + s3.y) / 2.0},

                l1 = Math.sqrt(dx1*dx1 + dy1*dy1),
                l2 = Math.sqrt(dx2*dx2 + dy2*dy2),

                dxm = (m1.x - m2.x),
                dym = (m1.y - m2.y),

                k = l2 / (l1 + l2),
                cm = {x: m2.x + dxm*k, y: m2.y + dym*k},

                tx = s2.x - cm.x,
                ty = s2.y - cm.y;

            return {
                c1: new Point(m1.x + tx, m1.y + ty),
                c2: new Point(m2.x + tx, m2.y + ty)
            };
        };

        SignaturePad.prototype._addCurve = function (curve) {
            var startPoint = curve.startPoint,
                endPoint = curve.endPoint,
                velocity, newWidth;

            velocity = endPoint.velocityFrom(startPoint);
            velocity = this.velocityFilterWeight * velocity
                + (1 - this.velocityFilterWeight) * this._lastVelocity;

            newWidth = this._strokeWidth(velocity);
            this._drawCurve(curve, this._lastWidth, newWidth);

            this._lastVelocity = velocity;
            this._lastWidth = newWidth;
        };

        SignaturePad.prototype._drawPoint = function (x, y, size) {
            var ctx = this._ctx;

            ctx.moveTo(x, y);
            ctx.arc(x, y, size, 0, 2 * Math.PI, false);
            this._isEmpty = false;
        };

        SignaturePad.prototype._drawCurve = function (curve, startWidth, endWidth) {
            var ctx = this._ctx,
                widthDelta = endWidth - startWidth,
                drawSteps, width, i, t, tt, ttt, u, uu, uuu, x, y;

            drawSteps = Math.floor(curve.length());
            ctx.beginPath();
            for (i = 0; i < drawSteps; i++) {
                // Calculate the Bezier (x, y) coordinate for this step.
                t = i / drawSteps;
                tt = t * t;
                ttt = tt * t;
                u = 1 - t;
                uu = u * u;
                uuu = uu * u;

                x = uuu * curve.startPoint.x;
                x += 3 * uu * t * curve.control1.x;
                x += 3 * u * tt * curve.control2.x;
                x += ttt * curve.endPoint.x;

                y = uuu * curve.startPoint.y;
                y += 3 * uu * t * curve.control1.y;
                y += 3 * u * tt * curve.control2.y;
                y += ttt * curve.endPoint.y;

                width = startWidth + ttt * widthDelta;
                this._drawPoint(x, y, width);
            }
            ctx.closePath();
            ctx.fill();
        };

        SignaturePad.prototype._strokeWidth = function (velocity) {
            return Math.max(this.maxWidth / (velocity + 1), this.minWidth);
        };


        var Point = function (x, y, time) {
            this.x = x;
            this.y = y;
            this.time = time || new Date().getTime();
        };

        Point.prototype.velocityFrom = function (start) {
            return (this.time !== start.time) ? this.distanceTo(start) / (this.time - start.time) : 1;
        };

        Point.prototype.distanceTo = function (start) {
            return Math.sqrt(Math.pow(this.x - start.x, 2) + Math.pow(this.y - start.y, 2));
        };

        var Bezier = function (startPoint, control1, control2, endPoint) {
            this.startPoint = startPoint;
            this.control1 = control1;
            this.control2 = control2;
            this.endPoint = endPoint;
        };

        // Returns approximated length.
        Bezier.prototype.length = function () {
            var steps = 10,
                length = 0,
                i, t, cx, cy, px, py, xdiff, ydiff;

            for (i = 0; i <= steps; i++) {
                t = i / steps;
                cx = this._point(t, this.startPoint.x, this.control1.x, this.control2.x, this.endPoint.x);
                cy = this._point(t, this.startPoint.y, this.control1.y, this.control2.y, this.endPoint.y);
                if (i > 0) {
                    xdiff = cx - px;
                    ydiff = cy - py;
                    length += Math.sqrt(xdiff * xdiff + ydiff * ydiff);
                }
                px = cx;
                py = cy;
            }
            return length;
        };

        Bezier.prototype._point = function (t, start, c1, c2, end) {
            return          start * (1.0 - t) * (1.0 - t)  * (1.0 - t)
                   + 3.0 *  c1    * (1.0 - t) * (1.0 - t)  * t
                   + 3.0 *  c2    * (1.0 - t) * t          * t
                   +        end   * t         * t          * t;
        };

        return SignaturePad;
    })(document);
