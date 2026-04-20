import{i as e}from"./chunk-DseTPa7n.js";import{t}from"./react-CIi_Xeu6.js";import{t as n}from"./jsx-runtime-Ds4jeNO1.js";import{t as r}from"./utils-D4bLmd5U.js";import{a as i}from"./dist-ZSiKGtww.js";import{t as a}from"./dist-DFU7f1XP.js";import{n as o}from"./dist-DYfflQJa.js";import{n as s,t as c}from"./dist-BVun2n7h.js";import{t as l}from"./dist-DC2ZNkhc.js";import{t as u}from"./dist-BkMYvLIt.js";import{t as d}from"./label-C-NmWOXn.js";var f=e(t(),1),p=n(),m=`Switch`,[h,g]=o(m),[_,v]=h(m),y=f.forwardRef((e,t)=>{let{__scopeSwitch:n,name:r,checked:o,defaultChecked:l,required:u,disabled:d,value:h=`on`,onCheckedChange:g,form:v,...y}=e,[b,x]=f.useState(null),S=i(t,e=>x(e)),T=f.useRef(!1),E=b?v||!!b.closest(`form`):!0,[D,O]=c({prop:o,defaultProp:l??!1,onChange:g,caller:m});return(0,p.jsxs)(_,{scope:n,checked:D,disabled:d,children:[(0,p.jsx)(a.button,{type:`button`,role:`switch`,"aria-checked":D,"aria-required":u,"data-state":w(D),"data-disabled":d?``:void 0,disabled:d,value:h,...y,ref:S,onClick:s(e.onClick,e=>{O(e=>!e),E&&(T.current=e.isPropagationStopped(),T.current||e.stopPropagation())})}),E&&(0,p.jsx)(C,{control:b,bubbles:!T.current,name:r,value:h,checked:D,required:u,disabled:d,form:v,style:{transform:`translateX(-100%)`}})]})});y.displayName=m;var b=`SwitchThumb`,x=f.forwardRef((e,t)=>{let{__scopeSwitch:n,...r}=e,i=v(b,n);return(0,p.jsx)(a.span,{"data-state":w(i.checked),"data-disabled":i.disabled?``:void 0,...r,ref:t})});x.displayName=b;var S=`SwitchBubbleInput`,C=f.forwardRef(({__scopeSwitch:e,control:t,checked:n,bubbles:r=!0,...a},o)=>{let s=f.useRef(null),c=i(s,o),d=l(n),m=u(t);return f.useEffect(()=>{let e=s.current;if(!e)return;let t=window.HTMLInputElement.prototype,i=Object.getOwnPropertyDescriptor(t,`checked`).set;if(d!==n&&i){let t=new Event(`click`,{bubbles:r});i.call(e,n),e.dispatchEvent(t)}},[d,n,r]),(0,p.jsx)(`input`,{type:`checkbox`,"aria-hidden":!0,defaultChecked:n,...a,tabIndex:-1,ref:c,style:{...a.style,...m,position:`absolute`,pointerEvents:`none`,opacity:0,margin:0}})});C.displayName=S;function w(e){return e?`checked`:`unchecked`}var T=y,E=x;function D({className:e,size:t=`default`,...n}){return(0,p.jsx)(T,{"data-slot":`switch`,"data-size":t,className:r(`peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 group/switch inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6`,e),...n,children:(0,p.jsx)(E,{"data-slot":`switch-thumb`,className:r(`bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block rounded-full ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0`)})})}D.__docgenInfo={description:``,methods:[],displayName:`Switch`,props:{size:{required:!1,tsType:{name:`union`,raw:`"sm" | "default"`,elements:[{name:`literal`,value:`"sm"`},{name:`literal`,value:`"default"`}]},description:``,defaultValue:{value:`"default"`,computed:!1}}}};var O={title:`UI/Switch`,component:D,tags:[`autodocs`],argTypes:{size:{control:`select`,options:[`sm`,`default`]}}},k={},A={args:{defaultChecked:!0}},j={args:{disabled:!0}},M={args:{disabled:!0,defaultChecked:!0}},N={args:{size:`sm`}},P={render:()=>(0,p.jsxs)(`div`,{className:`flex items-center gap-3`,children:[(0,p.jsx)(D,{id:`notifs`,defaultChecked:!0}),(0,p.jsx)(d,{htmlFor:`notifs`,children:`Notificaciones activas`})]})},F={render:()=>(0,p.jsxs)(`div`,{className:`space-y-3`,children:[(0,p.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,p.jsx)(d,{htmlFor:`dark-mode`,children:`Modo oscuro`}),(0,p.jsx)(D,{id:`dark-mode`})]}),(0,p.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,p.jsx)(d,{htmlFor:`auto-cat`,children:`Auto-categorización`}),(0,p.jsx)(D,{id:`auto-cat`,defaultChecked:!0})]})]})};k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{}`,...k.parameters?.docs?.source}}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  args: {
    defaultChecked: true
  }
}`,...A.parameters?.docs?.source}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...j.parameters?.docs?.source}}},M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true,
    defaultChecked: true
  }
}`,...M.parameters?.docs?.source}}},N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  args: {
    size: "sm"
  }
}`,...N.parameters?.docs?.source}}},P.parameters={...P.parameters,docs:{...P.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-3">
      <Switch id="notifs" defaultChecked />
      <Label htmlFor="notifs">Notificaciones activas</Label>
    </div>
}`,...P.parameters?.docs?.source}}},F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  render: () => <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="dark-mode">Modo oscuro</Label>
        <Switch id="dark-mode" />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="auto-cat">Auto-categorización</Label>
        <Switch id="auto-cat" defaultChecked />
      </div>
    </div>
}`,...F.parameters?.docs?.source}}};var I=[`Default`,`Checked`,`Disabled`,`DisabledChecked`,`Small`,`WithLabel`,`WithLabelRight`];export{A as Checked,k as Default,j as Disabled,M as DisabledChecked,N as Small,P as WithLabel,F as WithLabelRight,I as __namedExportsOrder,O as default};