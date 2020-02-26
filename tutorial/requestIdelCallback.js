/** @jsx createElement */
import createElement from '../createElement'
import render from '../stack/render'

let TIMES = 1000

let cancelFiberId = null
const runFiber = () => {
  
  let times = TIMES
  if (cancelFiberId) cancelIdleCallback(cancelFiberId) 

  const loop = (deadline) => {
    /**
     * 浏览器调用workUint的时机
     * deadline表示当前帧还有多少空余时间，当当前帧没有空闲时间的时候，退出任务执行
     * 等待下一次空闲时间
     */
    while (deadline.timeRemaining() > 1 && times > 0) {
      console.log(times)
      times--
    }
    cancelFiberId = requestIdleCallback(loop)
  }
  cancelFiberId = requestIdleCallback(loop)
}

const runStack = () => {
  if (cancelFiberId) cancelIdleCallback(cancelFiberId) 
  let times = TIMES
  while (times > 0) {
    console.log(times)
    times--
  }
}

const changeTimes = (e) => {
  TIMES = e.target.value
}

const inputStyle = `
  padding: 5px;
  border-radius: 5px;
  outline-style: none;
  border: 1px solid #ccc;
  color: #555;
`

const inputTimesStyle = `
  ${inputStyle}
  width: 50px;
`

const buttonStyle = `
  margin-left: 10px
`

const boxStyle = `
  animation-name: xy-fade-in-right;
  animation-duration: 1s;
  animation-iteration-count: infinite;
  width: 100px;
  height: 100px;
  background: #555;
  margin-top: 10px;
`

/* 插入动画 */
const style = document.createElement("style");
style.innerHTML =(`
  @keyframes xy-fade-in-right {
    from {
      opacity: 0;
      transform: translate3d(100%, 0, 0);
    }

    to {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
  }
`)
document.body.appendChild(style)

render(document.getElementById('root'),(
  <div>
    <input style={inputStyle} placeholder="try and type in" />
    <input style={inputTimesStyle} placeholder="times" value={TIMES} onChange={changeTimes}/>
    <button onClick={runFiber} style={buttonStyle}>Run Fiber</button>
    <button onClick={runStack} style={buttonStyle}>Run Stack</button>
    <div style={boxStyle}></div>
  </div>
))
