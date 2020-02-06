/**
 * fiber数据结构本质上可以理解为
 * 便于多叉树的深度遍历的一个结构
 * 相对于stack reconcile中instance-tree
 * fiber-tree增加了siblings和parent的指针，方便了节点的深度遍历
 * 详细fiber结构图可以看asstes/fiber-tree.png
 */

/**
 * workLoop
 * 
 * 背景：
 * 浏览器需要一帧的绘制中可能会处理的任务
 * 用户事件，js处理（宏任务，微任务，rAF，rIC），渲染（layout，paint，layer，composite等）
 * 如果某个任务处理的时间过长，不能在一帧内处理完，会造成后面事件的严重阻塞
 * 例如：
 * 1. 影响用户的交互事件：输入，滚动
 * 2. 影响部分css动画（有部分动画有GPU优化处理，不受js阻塞）
 * 
 * stack reconcile的弊端：
 * 一旦reconcile开始，就必须遍历整个instance-tree，无法打断，如果执行过长会导致后续高优任务严重阻塞
 * 
 * 因此，我们需要将之前的stacks进行拆解，把每一个节点的diff/instantiate放于一个独立workunit中
 * 这样可以颗粒化后的任务，再由workloop进行统一的调度，并利用浏览器的rIC回调，在浏览器闲时运行
 * 这样能避免过长时间占用主线程
 */
const workLoop = (callback, breakLoop) => {
  const loop = (deadline) => {
    /**
     * 浏览器调用workUint的时机
     * deadline表示当前帧还有多少空余时间，当当前帧没有空闲时间的时候，退出任务执行
     * 等待下一次空闲时间
     */
    while (deadline.timeRemaining() > 1) {
      if (breakLoop && breakLoop()) break
      callback()
    }
    requestIdleCallback(loop)
  }
  requestIdleCallback(loop)
}

/** 
 * Fiber 后续需要更新
 * 一个独立的workUnit
 * @param { parent } Fiber 父fiber节点
 * @param { child } Fiber 第一个子fiber节点
 * @param { sibling } Fiber 下一个兄弟fiber节点
 * @param { dom } Dom 对应的dom节点
 * @param { committedFiber } Fiber 对应的同一位置的旧fiber
 * @param { effectTag } string 表示这个fiber在commit的时候需要的dom操作
 * 1. PLACEMENT: 表示在commit阶段要插入的元素
 * 2. DELETION: 表示在commit阶段要被删除的元素
 * 3. UPDATE: 表示在commit阶段复用dom，只需要做dom属性更新
 * 
 * hooks在function component 相当于 state在于class component
 * @param { hooks } array 每个hook代表一个state和响应变化的action
 * @param { hook.state } any 一个hook的state值
 * @param { hook.queue } array 代表每个对state做出改变的action
 * 
 * @param { type } elementType
 * @param { props } elementProps
 */

/* 根据fiber类型生成对应dom节点，并赋予对应属性 */
const createDom = (fiber) => {
  const dom =
    fiber.type === "TEXT_TYPE"
      ? document.createTextNode("")
      : document.createElement(fiber.type)

  updateDomProperties(dom, fiber.props)

  return dom
}

/* 更新dom属性 */
const updateDomProperties = (dom, nextProps, prevProps) => {
  const isEvent = name => name.startsWith("on")
  const isAttribute = name => !isEvent(name) && name !== "children"

  /* 如果dom元素之前存在属性，则先取消之前的属性和事件绑定 */
  if (prevProps) {
    Object.keys(prevProps).forEach((key) => {
      if (isAttribute(key)) {
        dom[key] = null
      } else if (isEvent(key)) {
        const eventType = key.toLowerCase().substring(2)
        dom.removeEventListener(eventType, prevProps[key])
      }
    })
  }

  /* 绑定新的属性和事件 */
  Object.keys(nextProps).forEach((key) => {
    if (isAttribute(key)) {
      dom[key] = nextProps[key]
    } else if (isEvent(key)) {
      const eventType = key.toLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[key])
    }
  })
}

/** 
 * performWorkUnit的作用是：将element-tree转化为fiber-tree
 * fiber-tree目前还有dom fiber，function component fiber两种
 * 
 * 对一个fiberUnit进行处理
 * 1. 处理fiber的更新，新增，删除的等操作
 * 2. 生成子fiber节点，并处理好child，parent，sibling的指向形成fiber-tree（详见reconcileChildren方法）
 * 3. 返回下一个fiberUnit
 * 
 * 返回规则是：
 * 1. 如果有child，直接返回child
 * 2. 否则，如果有sibling，返回sibling
 * 3. 否则，如果存在parent.sibling，将其返回，否则查看parent.parent.sibling，以此类推
 * 4. 如果都不符合，表示fiber-tree遍历完全，work done
 */
const performWorkUnit = (fiber) => {
  const isFunctionComponent = fiber.type instanceof Function

  if (isFunctionComponent) {
    /* function component fiber*/
    updateFunctionComponent(fiber)
  } else {
    /* dom fiber */
    updateHostComponent(fiber)
  }

  /* 如果存在子fiber，那么子fiber是下一个任务 */
  if (fiber.child) {
    return fiber.child
  }

  /* 不存在子sibling，则寻找siblings || parent.siblings || parent.parent.siblings... */
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

/**
 * function component的hooks是根据调用位置去做定位的
 * 所以需要提供一个全局的hookIndex 
 */
let hookIndex = 0

/* 更新function component类型的fiber */
function updateFunctionComponent(fiber) {
  /* 每次处理function component，hookIndex和hooks都需要初始化 */
  hookIndex = 0
  fiber.hooks = []

  /* function component的子元素是方法的返回结果 */
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

/**
 * useState
 * 1. 在对应的fiber上添加了响应的hook（包含state，queue，以调用位置区分）
 * 2. 返回最新的state，并提供更新state的方法，该方法会重新开始render一轮fiber-tree
 */
const useState = (initialState) => {
  /**
   * useState的运行肯定发生在updateFunctionComponent调用栈中
   * 因此使用该方法的fiber肯定是正在performance的nextFiber 
   */
  const currentFiber = nextFiber

  /* 对于UPDATE状态的fiber，需要承接state状态 */
  const oldHook =
    currentFiber.committedFiber &&
    currentFiber.committedFiber.hooks &&
    currentFiber.committedFiber.hooks[hookIndex]

  let hook = null

  if (oldHook) {
    /**
     * 如果对应位置存在hook则继承其状态
     * 并运行queue中的actions，进行状态的改变 
     */
    hook = {
      state: oldHook.state,
      queue: []
    }
    oldHook.queue.forEach(action => {
      /* 更新state */
      action(hook)
    })
  } else {
    /**
     * 如果对应位置不存在hook，表示这是第一次调用，初始化
     */
    hook = {
      state: initialState,
      queue: []
    }
  }

  const setState = state => {
    /**
     * 这边选择将state的更新放在下一轮的fiber更新中
     * 感觉是为了方便将fiber hooks的state的改变进行统一的管理
     * 例如，useEffect估计也会被推入queue中，这样整个fiber的信息会更加全面些
     */
    hook.queue.push((hook) => hook.state = state)

    /**
     * 每次运行setState都会从根fiber进行渲染
     * TODO：从运行的节点开始渲染
     */
    rootFiber = {
      dom: rootCommittedFiber.dom,
      props: rootCommittedFiber.props,
      committedFiber: rootCommittedFiber,
    }
    deletions = []
    nextFiber = rootFiber
  }

  /* 将最新的hooks推入fiber.hooks进行状态保存 */
  currentFiber.hooks.push(hook)

  hookIndex++
  return [hook.state, setState]
}

/* 更新dom类型的fiber */
function updateHostComponent(fiber) {
  /* 对新增的dom fiber进行dom添加 */
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  /* dom fiber的子元素就是其实children */
  reconcileChildren(fiber, fiber.props.children)
}

/**
 * fiber-tree的搭建（子fiber的搭建）
 * 与stack reconcile分为update，placement(new, replacing)，deletion(removed, replaced)三种情况
 * 其中placement表示增加的元素，其来自新增的元素和要替换的元素
 * deletion表示要删除的元素，其来自被删除和被替换的元素
 * 其中update这种情况需要保存committedFiber，用于做新旧fiber的children的reconcile
 */
const reconcileChildren = (fiber, children) => {
  /* 对应位置的旧的child（第一个开始） */
  let oldChild = fiber.committedFiber && fiber.committedFiber.child

  /* 用于方便进行sibling链操作 */
  let prevSibling = null

  let index = 0
  while (index < children.length || oldChild) {
    const element = children[index]
    let newFiber = null
    const isSameType = element
      && oldChild
      && element.type === oldChild.type

    if (isSameType) {
      /**
       * 表示新老fiber为同一type类型，走UPDATE流程，并并入最新的fiber-tree
       * dom复用
       */
      newFiber = {
        type: element.type,
        props: element.props,
        dom: oldChild.dom,
        parent: fiber,
        committedFiber: oldChild,
        effectTag: "UPDATE",
      }
    }

    if (element && !isSameType) {
      /**
       * PLACEMENT涵盖两类
       * 1. 新旧fiber不是同一个类型，新的fiber是传统意义上的替换元素（replacing）
       * 2. 旧fiber不存在，新fiber是新增加的，新fiber是传统意义上的new
       * 这时候后创建的新fiber走placement流程，并被并入最新的fiber-tree，表示是需要在commit阶段被append的
       */
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: fiber,
        committedFiber: null,
        effectTag: "PLACEMENT",
      }
    }
    if (oldChild && !isSameType) {
      /**
       * DELETION涵盖两类
       * 1. 新旧fiber不是同一个类型，旧fiber是传统意义上的被替换元素（replaced）
       * 2. 新fiber不存在，旧fiber是被删除的，传统意义上的remove
       * 这种情况不会被并入最新的fiber-tree，而是被推入deletions中，用于commit阶段的删除操作
       */
      oldChild.effectTag = "DELETION"
      deletions.push(oldChild)
    }

    if (oldChild) {
      oldChild = oldChild.sibling
    }

    if (index === 0) {
      fiber.child = newFiber
    } else if (newFiber) {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}



/**
 * 根据fiber-tree，对dom进行统一的操作
 * 由于现在的fiber-tree创建阶段是异步的，分散再多个rIC周期中
 * 统一的dom操作可以避免出现局部dom渲染发生的情况
 */
const commitRoot = () => {
  const commitFiberNode = (fiber) => {
    if (!fiber) {
      return
    }

    /* 寻找最近具有dom的fiber节点 */
    let domParentFiber = fiber.parent
    while (!domParentFiber.dom) {
      domParentFiber = domParentFiber.parent
    }
    const domParent = domParentFiber.dom

    if (
      fiber.effectTag === "PLACEMENT" &&
      fiber.dom != null
    ) {
      /**
       * PLACEMENT的情况表示该fiber属于需要被插入的节点
       */
      domParent.appendChild(fiber.dom)
    } else if (
      fiber.effectTag === "UPDATE" &&
      fiber.dom != null
    ) {
      /**
       * UPDATE的情况表示该fiber和元fiber可以共用一个dom
       * 只需要做属性的新老替换
       */
      updateDomProperties(
        fiber.dom,
        fiber.props,
        fiber.committedFiber.props
      )
    } else if (fiber.effectTag === "DELETION") {
      /**
       * DELETION的情况表示该fiber属于需要被删除的节点
       * 找到其最后渲染出来的dom，并做删除
       */
      let domFiber = fiber
      while (!domFiber.dom) {
        domFiber = domFiber.child
      }
      domParent.removeChild(domFiber.dom)
    }

    /* 递归child和sibling */
    if (fiber.child) commitFiberNode(fiber.child)
    if (fiber.sibling) commitFiberNode(fiber.sibling)
  }

  deletions.forEach(fiber =>commitFiberNode(fiber))
  commitFiberNode(rootFiber.child)

  rootCommittedFiber = rootFiber
  rootFiber = null
}

 /**
  * render
  * 初始化workUnit
  * 
  * nextFiber: 下一个需要被处理fiber节点
  * rootFiber: 提交前的根fiber
  * rootCommittedFiber: 被提交的根fiber
  * deletions: 表示需要被删除的fiber
  */
 let nextFiber = null
 let rootFiber = null
 let deletions = null
 let rootCommittedFiber = null
 const render = (container, element) => {
  rootFiber = nextFiber = {
    dom: container,
    props: {
      children: [element]
    },
    committedFiber: rootCommittedFiber
  }
  deletions = []
}

/**
 * 开始循环任务
 */
workLoop(() => {
  if (nextFiber) { 
    nextFiber = performWorkUnit(nextFiber)
  } else if (rootFiber) {
    /* 如果结束perform，开始对dom进行统一挂载操作 */
    commitRoot()
  }
}, () => {
  return !nextFiber && !rootFiber
})


/* export */
export default render
export {
  rootFiber,
  useState
}