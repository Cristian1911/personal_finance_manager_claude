import{i as e}from"./chunk-DseTPa7n.js";import{t}from"./react-CIi_Xeu6.js";import{t as n}from"./jsx-runtime-Ds4jeNO1.js";import{t as r}from"./utils-D4bLmd5U.js";import{t as i}from"./dist-DFU7f1XP.js";import{n as a}from"./dist-DYfflQJa.js";var o=e(t(),1),s=n(),c=`Progress`,l=100,[u,d]=a(c),[f,p]=u(c),m=o.forwardRef((e,t)=>{let{__scopeProgress:n,value:r=null,max:a,getValueLabel:o=_,...c}=e;(a||a===0)&&!b(a)&&console.error(S(`${a}`,`Progress`));let u=b(a)?a:l;r!==null&&!x(r,u)&&console.error(C(`${r}`,`Progress`));let d=x(r,u)?r:null,p=y(d)?o(d,u):void 0;return(0,s.jsx)(f,{scope:n,value:d,max:u,children:(0,s.jsx)(i.div,{"aria-valuemax":u,"aria-valuemin":0,"aria-valuenow":y(d)?d:void 0,"aria-valuetext":p,role:`progressbar`,"data-state":v(d,u),"data-value":d??void 0,"data-max":u,...c,ref:t})})});m.displayName=c;var h=`ProgressIndicator`,g=o.forwardRef((e,t)=>{let{__scopeProgress:n,...r}=e,a=p(h,n);return(0,s.jsx)(i.div,{"data-state":v(a.value,a.max),"data-value":a.value??void 0,"data-max":a.max,...r,ref:t})});g.displayName=h;function _(e,t){return`${Math.round(e/t*100)}%`}function v(e,t){return e==null?`indeterminate`:e===t?`complete`:`loading`}function y(e){return typeof e==`number`}function b(e){return y(e)&&!isNaN(e)&&e>0}function x(e,t){return y(e)&&!isNaN(e)&&e<=t&&e>=0}function S(e,t){return`Invalid prop \`max\` of value \`${e}\` supplied to \`${t}\`. Only numbers greater than 0 are valid max values. Defaulting to \`${l}\`.`}function C(e,t){return`Invalid prop \`value\` of value \`${e}\` supplied to \`${t}\`. The \`value\` prop must be:
  - a positive number
  - less than the value passed to \`max\` (or ${l} if no \`max\` prop is set)
  - \`null\` or \`undefined\` if the progress is indeterminate.

Defaulting to \`null\`.`}var w=m,T=g;function E({className:e,value:t,...n}){return(0,s.jsx)(w,{"data-slot":`progress`,className:r(`bg-primary/20 relative h-2 w-full overflow-hidden rounded-full`,e),...n,children:(0,s.jsx)(T,{"data-slot":`progress-indicator`,className:`bg-primary h-full w-full flex-1 transition-all`,style:{transform:`translateX(-${100-(t||0)}%)`}})})}E.__docgenInfo={description:``,methods:[],displayName:`Progress`};var D={title:`UI/Progress`,component:E,tags:[`autodocs`],decorators:[e=>(0,s.jsx)(`div`,{className:`w-64 p-4`,children:(0,s.jsx)(e,{})})]},O={args:{value:45}},k={args:{value:20}},A={args:{value:80}},j={args:{value:110}},M={args:{value:0}},N={args:{value:100}},P={render:()=>(0,s.jsxs)(`div`,{className:`space-y-4 w-64`,children:[(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`p`,{className:`text-xs text-muted-foreground mb-1`,children:`20% — bajo uso`}),(0,s.jsx)(E,{value:20})]}),(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`p`,{className:`text-xs text-muted-foreground mb-1`,children:`60% — normal`}),(0,s.jsx)(E,{value:60})]}),(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`p`,{className:`text-xs text-muted-foreground mb-1`,children:`85% — advertencia`}),(0,s.jsx)(E,{value:85})]}),(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`p`,{className:`text-xs text-muted-foreground mb-1`,children:`100% — completo`}),(0,s.jsx)(E,{value:100})]})]})};O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  args: {
    value: 45
  }
}`,...O.parameters?.docs?.source}}},k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  args: {
    value: 20
  }
}`,...k.parameters?.docs?.source}}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  args: {
    value: 80
  }
}`,...A.parameters?.docs?.source}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  args: {
    value: 110
  }
}`,...j.parameters?.docs?.source}}},M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  args: {
    value: 0
  }
}`,...M.parameters?.docs?.source}}},N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  args: {
    value: 100
  }
}`,...N.parameters?.docs?.source}}},P.parameters={...P.parameters,docs:{...P.parameters?.docs,source:{originalSource:`{
  render: () => <div className="space-y-4 w-64">
      <div>
        <p className="text-xs text-muted-foreground mb-1">20% — bajo uso</p>
        <Progress value={20} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">60% — normal</p>
        <Progress value={60} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">85% — advertencia</p>
        <Progress value={85} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">100% — completo</p>
        <Progress value={100} />
      </div>
    </div>
}`,...P.parameters?.docs?.source}}};var F=[`Default`,`Low`,`Warning`,`Over`,`Zero`,`Full`,`AllStates`];export{P as AllStates,O as Default,N as Full,k as Low,j as Over,A as Warning,M as Zero,F as __namedExportsOrder,D as default};