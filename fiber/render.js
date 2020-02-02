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
 * @param { committedFiber } 对应的同一位置的旧fiber
 * @param { effectTag } 表示这个fiber在commit的时候需要的dom操作
 * 1. PLACEMENT: 表示在commit阶段要插入的元素
 * 2. DELETION: 表示在commit阶段要被删除的元素
 * 3. UPDATE: 表示在commit阶段复用dom，只需要做dom属性更新
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
 * 
 * 对一个fiberUnit进行处理
 * 1. 生成相应的dom，如果fiber本身存在dom则不需要创建（一般是复用的情况）
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
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  /* 子fiber-tree搭建 */
  reconcileChildren(fiber)

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
 * fiber-tree的搭建（子fiber的搭建）
 * 与stack reconcile分为update，placement(new, replacing)，deletion(removed, replaced)三种情况
 * 其中placement表示增加的元素，其来自新增的元素和要替换的元素
 * deletion表示要删除的元素，其来自被删除和被替换的元素
 * 其中update这种情况需要保存committedFiber，用于做新旧fiber的children的reconcile
 */
const reconcileChildren = (fiber) => {
  /* 新的子元素 */
  const children = fiber.props.children

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

    if (
      fiber.effectTag === "PLACEMENT" &&
      fiber.dom != null
    ) {
      /**
       * PLACEMENT的情况表示该fiber属于需要被插入的节点
       */
      fiber.parent.dom.appendChild(fiber.dom)
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
        fiber.committedFiber.props,
        fiber.props
      )
    } else if (fiber.effectTag === "DELETION") {
      /**
       * DELETION的情况表示该fiber属于需要被删除的节点
       */
      fiber.parent.dom.removeChild(fiber.dom)
    }

    /* 递归child和sibling */
    if (fiber.child) commitFiberNode(fiber.child)
    if (fiber.sibling) commitFiberNode(fiber.sibling)
  }

  deletions.forEach(fiber =>commitFiberNode(fiber))
  commitFiberNode(rootFiber)

  committedFiber = rootFiber
  rootFiber = null
}

 /**
  * render
  * 初始化workUnit
  * 
  * nextFiber: 下一个需要被处理fiber节点
  * rootFiber: 提交前的根fiber
  * committedFiber: 新fiber如果和同位的旧fiber相同类型，那么具有这个属性，其表示同位的旧fiber，用于同类型fiber的reconcile
  * deletions: 表示需要被删除的fiber
  */
 let nextFiber = null
 let rootFiber = null
 let deletions = null
 let committedFiber = null
 const render = (container, element) => {
  rootFiber = nextFiber = {
    dom: container,
    props: {
      children: [element]
    },
    committedFiber
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
  rootFiber
}