/** 
 * leactElement
 * dom --> leactElement
 * leactElement是关于node（暂时为dom）的一种json描述
 * 
 * <div id="app">hello</div> 
 * 等价于
 * {
 *  type: 'div'
 *  props: {
 *    id: 'app',
 *    children: 'hello'
 *  }
 * }
 */
/** 
 * type: node类型（暂时为dom）
 * props: 元素上的属性值
 * children: 子node，数组形态
 */
const createElement = (type, props = {}, ...children) => {
  return {
    type,
    props: {
      ...props,
      /** 
       * 子元素存在string的情况
       * 为了统一处理，需要包装成textElement
       * null & false都是要被过滤掉的
       */
      children: children
        .filter(c => c != null && c !== false)
        .map(child => (
          typeof child === 'object'
          ? child
          : createTextElement(child)
        ))
    }
  }
}

/* 对字符串元素做统一化处理，保证与其他元素一致 */
const createTextElement = (text) => {
  return {
    type: 'TEXT_TYPE',
    props: {
      nodeValue: text,
      children: []
    }
  }
}

export default createElement