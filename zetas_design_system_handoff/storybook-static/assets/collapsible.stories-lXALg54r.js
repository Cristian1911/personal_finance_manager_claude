import{i as e}from"./chunk-DseTPa7n.js";import{t}from"./react-CIi_Xeu6.js";import{t as n}from"./jsx-runtime-Ds4jeNO1.js";import{t as r}from"./chevron-down-x95mM0is.js";import{a as i}from"./dist-ZSiKGtww.js";import{t as a}from"./dist-DFU7f1XP.js";import{n as o}from"./dist-DYfflQJa.js";import{n as s,t as c}from"./dist-BVun2n7h.js";import{t as l}from"./dist-pqhuu1j4.js";import{t as u}from"./dist-C2qZp2J7.js";import{t as d}from"./dist-_uMcgxYn.js";import{t as f}from"./button-CNP2-gLS.js";var p=e(t(),1),m=n(),h=`Collapsible`,[g,_]=o(h),[v,y]=g(h),b=p.forwardRef((e,t)=>{let{__scopeCollapsible:n,open:r,defaultOpen:i,disabled:o,onOpenChange:s,...l}=e,[u,f]=c({prop:r,defaultProp:i??!1,onChange:s,caller:h});return(0,m.jsx)(v,{scope:n,disabled:o,contentId:d(),open:u,onOpenToggle:p.useCallback(()=>f(e=>!e),[f]),children:(0,m.jsx)(a.div,{"data-state":E(u),"data-disabled":o?``:void 0,...l,ref:t})})});b.displayName=h;var x=`CollapsibleTrigger`,S=p.forwardRef((e,t)=>{let{__scopeCollapsible:n,...r}=e,i=y(x,n);return(0,m.jsx)(a.button,{type:`button`,"aria-controls":i.contentId,"aria-expanded":i.open||!1,"data-state":E(i.open),"data-disabled":i.disabled?``:void 0,disabled:i.disabled,...r,ref:t,onClick:s(e.onClick,i.onOpenToggle)})});S.displayName=x;var C=`CollapsibleContent`,w=p.forwardRef((e,t)=>{let{forceMount:n,...r}=e,i=y(C,e.__scopeCollapsible);return(0,m.jsx)(u,{present:n||i.open,children:({present:e})=>(0,m.jsx)(T,{...r,ref:t,present:e})})});w.displayName=C;var T=p.forwardRef((e,t)=>{let{__scopeCollapsible:n,present:r,children:o,...s}=e,c=y(C,n),[u,d]=p.useState(r),f=p.useRef(null),h=i(t,f),g=p.useRef(0),_=g.current,v=p.useRef(0),b=v.current,x=c.open||u,S=p.useRef(x),w=p.useRef(void 0);return p.useEffect(()=>{let e=requestAnimationFrame(()=>S.current=!1);return()=>cancelAnimationFrame(e)},[]),l(()=>{let e=f.current;if(e){w.current=w.current||{transitionDuration:e.style.transitionDuration,animationName:e.style.animationName},e.style.transitionDuration=`0s`,e.style.animationName=`none`;let t=e.getBoundingClientRect();g.current=t.height,v.current=t.width,S.current||(e.style.transitionDuration=w.current.transitionDuration,e.style.animationName=w.current.animationName),d(r)}},[c.open,r]),(0,m.jsx)(a.div,{"data-state":E(c.open),"data-disabled":c.disabled?``:void 0,id:c.contentId,hidden:!x,...s,ref:h,style:{"--radix-collapsible-content-height":_?`${_}px`:void 0,"--radix-collapsible-content-width":b?`${b}px`:void 0,...e.style},children:x&&o})});function E(e){return e?`open`:`closed`}var D=b;function O({...e}){return(0,m.jsx)(D,{"data-slot":`collapsible`,...e})}function k({...e}){return(0,m.jsx)(S,{"data-slot":`collapsible-trigger`,...e})}function A({...e}){return(0,m.jsx)(w,{"data-slot":`collapsible-content`,...e})}O.__docgenInfo={description:``,methods:[],displayName:`Collapsible`},k.__docgenInfo={description:``,methods:[],displayName:`CollapsibleTrigger`},A.__docgenInfo={description:``,methods:[],displayName:`CollapsibleContent`};var j={title:`UI/Collapsible`,component:O,tags:[`autodocs`],decorators:[e=>(0,m.jsx)(`div`,{className:`w-80 p-4`,children:(0,m.jsx)(e,{})})]},M={render:()=>(0,m.jsxs)(O,{children:[(0,m.jsx)(k,{asChild:!0,children:(0,m.jsxs)(f,{variant:`ghost`,className:`w-full justify-between`,children:[`Gastos del mes`,(0,m.jsx)(r,{className:`size-4`})]})}),(0,m.jsxs)(A,{className:`mt-2 space-y-1 text-sm text-muted-foreground`,children:[(0,m.jsx)(`p`,{children:`Alimentación: $450,000`}),(0,m.jsx)(`p`,{children:`Transporte: $120,000`}),(0,m.jsx)(`p`,{children:`Ocio: $230,000`})]})]})},N={render:()=>(0,m.jsxs)(O,{defaultOpen:!0,children:[(0,m.jsx)(k,{asChild:!0,children:(0,m.jsxs)(f,{variant:`ghost`,className:`w-full justify-between`,children:[`Ver categorías`,(0,m.jsx)(r,{className:`size-4`})]})}),(0,m.jsxs)(A,{className:`mt-2 space-y-1 text-sm text-muted-foreground`,children:[(0,m.jsx)(`p`,{children:`Vivienda: $1,200,000`}),(0,m.jsx)(`p`,{children:`Salud: $80,000`}),(0,m.jsx)(`p`,{children:`Educación: $300,000`})]})]})};M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  render: () => <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between">
          Gastos del mes
          <ChevronDown className="size-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1 text-sm text-muted-foreground">
        <p>Alimentación: $450,000</p>
        <p>Transporte: $120,000</p>
        <p>Ocio: $230,000</p>
      </CollapsibleContent>
    </Collapsible>
}`,...M.parameters?.docs?.source}}},N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  render: () => <Collapsible defaultOpen>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between">
          Ver categorías
          <ChevronDown className="size-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1 text-sm text-muted-foreground">
        <p>Vivienda: $1,200,000</p>
        <p>Salud: $80,000</p>
        <p>Educación: $300,000</p>
      </CollapsibleContent>
    </Collapsible>
}`,...N.parameters?.docs?.source}}};var P=[`Default`,`OpenByDefault`];export{M as Default,N as OpenByDefault,P as __namedExportsOrder,j as default};