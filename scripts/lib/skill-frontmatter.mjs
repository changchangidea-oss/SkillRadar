function unquote(value=''){
  const text=String(value).trim()
  if((text.startsWith('"')&&text.endsWith('"'))||(text.startsWith("'")&&text.endsWith("'")))return text.slice(1,-1)
  return text
}

function blockScalar(lines,start,style){
  const collected=[]
  let index=start
  while(index<lines.length){
    const line=lines[index]
    if(line.trim()&&!/^[ \t]/.test(line))break
    collected.push(line)
    index++
  }
  const indents=collected.filter(line=>line.trim()).map(line=>line.match(/^[ \t]*/)[0].length)
  const indent=indents.length?Math.min(...indents):0
  const normalized=collected.map(line=>line.trim()?line.slice(indent).trim():'')
  const value=style==='>'
    ? normalized.join('\n').replace(/([^\n])\n(?=[^\n])/g,'$1 ').replace(/\n+/g,'\n').trim()
    : normalized.join('\n').trim()
  return {value,next:index}
}

export function parseSkillFrontmatter(markdown=''){
  const text=String(markdown).replace(/^\uFEFF/,'')
  const match=text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if(!match)return {}
  const lines=match[1].split(/\r?\n/),out={}
  for(let index=0;index<lines.length;index++){
    const field=lines[index].match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/)
    if(!field)continue
    const key=field[1],raw=field[2].trim(),marker=raw.match(/^([|>])[-+]?$/)
    if(marker){
      const parsed=blockScalar(lines,index+1,marker[1])
      out[key]=parsed.value
      index=parsed.next-1
    }else out[key]=unquote(raw)
  }
  return out
}
