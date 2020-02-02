import Component from './component'
/**
 * 新概念instance
 * 首先dom-tree可以理解为一种树状的数据保存形式
 * 如果我们仅仅是基于最简单的element-tree做diff会有以下几个问题
 * 1. 没有对应的dom属性，无法局部的更新
 * 2. 没有component的实例，无法实现生命周期，无法实现setState等功能
 * instantiate的过程就是将
 * element tree ---> instance tree
 * 而之所以这么做都是为我们的tree提供能方便的操作能力
 * 
 * 共有属性，dom element, function element, class element具有
 * @prop { instance.element } 对应的element信息
 * @prop { instance.dom } 对应的dom node，这个属性的意义在于我们需要对dom进行操作
 * 
 * dom element具有，因为只有dom element拥有多个子元素
 * @prop { instance.childInstances } 对应子元素的instance，方便进行树的递归遍历
 * 
 * function element, class element具有，因为function element, class element只有一个子元素
 * @prop { instance.childInstance } 对应子元素的instance，方便进行树的递归遍历
 * 
 * class element具有，因为这个通过class Component通过实例化生成的
 * @prop { instance.componentInstance } compositeElment对应的component实例，方便对生命周期等的调用
 */
const instantiate = (element) => {
  const type = element.type

  if (typeof type === 'string') {
    /* dom element */
    const dom = type === 'TEXT_TYPE'
    ? document.createTextNode('')
    : document.createElement(type)

    /* 将属性绑定到dom node上 */
    updateDomProperties(dom, element.props)

    /**
     * dom element的特点：
     * 每个子element都是需要被渲染，所以每个都需要实例化的
     * renderedElements = children
     */
    const childInstances = element.props.children.map(instantiate)
    childInstances.forEach((childInstance) => {
      dom.append(childInstance.dom)
    })

    return {
      dom,
      element,
      childInstances
    }
  } else if (type.prototype instanceof Component) {
    /* 这边用type.prototype判断是否是继承，es6中的继承一般是将实例示例挂载被继承的Component Class的prototype上 */
    /* class Component */
    const props = element.props
    const componentInstance = new type(props)

    /**
     * Component element的特点：
     * 需要被渲染的element，是通过实例render出来的
     */
    const renderedElement = componentInstance.render()
    const childInstance = instantiate(renderedElement)
    const instance = {
      element,
      /* dom在不断递归中，指向最近的dom instance的dom属性 */
      dom: childInstance.dom,
      childInstance,
      componentInstance
    }
    componentInstance.__instance = instance

    return instance
  } else if (typeof type === 'function') {
    /* function Component */
    const props = element.props
    const renderedElement = type(props)
    const childInstance = instantiate(renderedElement)

    return {
      element,
      /* 与component element一样，dom在不断递归中，指向最近的dom instance的dom属性 */
      dom: childInstance.dom,
      childInstance
    }
  }
}

/**
 * 更新dom元素的属性
 */
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
 * 将一个element tree渲染到某个dom节点
 * preRootInstance表示之前渲染过的rootInstance
 */
let preRootInstance = null
let render = (appDom, element) => {
  /* 判断是否存在已挂载节点 */
  if (preRootInstance) {
    /* 已有挂载节点，走更新流程 */
    const rootInstance = reconcile(appDom, preRootInstance, element)
    preRootInstance = rootInstance
  } else {
    /* 无挂载节点，走新增流程 */
    const rootInstance = instantiate(element)
    appDom.append(rootInstance.dom)
    preRootInstance = rootInstance
  }
}

/**
 * 将一个instance和一个element进行比较
 * 可以简单的理解成将老的instance-tree和新的element-tree进行比较
 */
const reconcile = (parentDom, prevInstance, nextElement) => {
  window.p = parentDom
  if (nextElement === undefined) {

    /* 老节点不存在新节点中，走删除流程 */
    parentDom.removeChild(prevInstance.dom)
    return null

  } else if (prevInstance === undefined) {

    /* 新节点不存在老节点中，走新增流程 */
    const nextInstance = instantiate(nextElement)
    parentDom.append(nextInstance.dom)
    return nextInstance

  } else if (prevInstance.element.type !== nextElement.type) {

    /* 新老节点类型不同，走替换流程 */
    const nextInstance = instantiate(nextElement)
    parentDom.replaceChild(nextInstance.dom, prevInstance.dom)
    return nextInstance

  } else if (typeof prevInstance.element.type === 'string') {
    /**
     * 新老节点类型相同，且为dom元素类型，走dom元素更新流程
     * 复用旧dom元素，直接更新dom属性
     * 向下reconcile子元素
     */
    const { props: prevProps } = prevInstance.element
    const { props: nextProps } = nextElement
  
    updateDomProperties(prevInstance.dom, nextProps, prevProps)

    /* childInstances需要重新reconcile */
    const childInstances = reconcileChild(prevInstance.dom, prevInstance.childInstances, nextProps.children)
    
    /* 我们直接更新/复用instance，并做返回*/
    prevInstance.childInstances = childInstances
    prevInstance.element = nextElement
    return prevInstance
  } else {
    /**
     * 新老节点类型相同，且为Component/Function元素类型，走Component/Function元素更新流程
     * 复用旧instance / componentInstance，但需要更新props
     * 向下reconcile子元素
     */

    let childElement = null
  
    if (prevInstance.element.type.prototype instanceof Component) {
      /** 
       * Component元素类型
       */
      prevInstance.componentInstance.props = nextElement.props
      childElement = prevInstance.componentInstance.render()
    } else {
      /** 
       * Function元素类型
       */
      childElement = nextElement.type(nextElement.props)
    }
    
    prevInstance.childInstance = reconcile(parentDom, prevInstance.childInstance, childElement)
    prevInstance.dom = prevInstance.childInstance.dom
    prevInstance.element = nextElement
    return prevInstance
  }
}

/** 
 * reconcile子元素
 * 目前子元素的reconcile只是对位置进行一一比较
 * 必不会对key进行比较，key的功能后续添加
 */
const reconcileChild = (parentDom, prevChildInstances, nextChildElements) => {
  let maxLength = Math.max(prevChildInstances.length, nextChildElements.length)
  const nextChildInstances = []
  /* 按排列顺序 */
  for (let i = 0; i < maxLength; i++) {
    const childInstance = reconcile(parentDom, prevChildInstances[i], nextChildElements[i])
    childInstance && nextChildInstances.push(childInstance)
  }

  return nextChildInstances
}

export default render

export {
  preRootInstance,
  instantiate,
  reconcile
}