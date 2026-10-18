import { describe, expect, it } from 'vitest';
import { defaults, fromStored, resolveTheme } from '@/lib/reading-prefs';

describe('tone preference',()=>{
  it('defaults to cool, so nobody sees a change until they choose one',()=>{
    expect(defaults.tone).toBe('cool');
    expect(fromStored(null).tone).toBe('cool');
  });
  it('keeps a stored warm choice',()=>{
    expect(fromStored({tone:'warm'}).tone).toBe('warm');
  });
  it('falls back to cool for an unknown value without resetting other choices',()=>{
    const p=fromStored({tone:'neon',theme:'light',themeV:2,size:'large'});
    expect(p.tone).toBe('cool');
    expect(p.theme).toBe('light');
    expect(p.size).toBe('large');
  });
  it('loads preferences saved before tone existed',()=>{
    const p=fromStored({theme:'light',themeV:2,size:'large',spacing:true,width:'narrow',font:'hyperlegible',density:'summary'});
    expect(p).toEqual({theme:'light',size:'large',spacing:true,width:'narrow',font:'hyperlegible',density:'summary',tone:'cool'});
  });
});

describe('theme preference',()=>{
  it('follows the device until the reader chooses',()=>{
    expect(defaults.theme).toBe('system');
    expect(fromStored(null).theme).toBe('system');
    expect(fromStored({size:'large'}).theme).toBe('system');
  });
  it('keeps a stored choice and falls back to system for an unknown value',()=>{
    for(const theme of ['system','light','dark','contrast']) expect(fromStored({theme,themeV:2}).theme).toBe(theme);
    expect(fromStored({theme:'neon',themeV:2,size:'large'})).toMatchObject({theme:'system',size:'large'});
  });
  it('resets a theme saved by an older version once, keeping the other settings',()=>{
    expect(fromStored({theme:'dark',size:'large'})).toMatchObject({theme:'system',size:'large'});
    expect(fromStored({theme:'light',themeV:1}).theme).toBe('system');
  });
  it('resolves system to what the device prefers, and a choice to itself',()=>{
    expect(resolveTheme('system',true,false)).toBe('light');
    expect(resolveTheme('system',false,false)).toBe('dark');
    for(const theme of ['light','dark','contrast'] as const){
      for(const light of [true,false]) for(const contrast of [true,false]) expect(resolveTheme(theme,light,contrast)).toBe(theme);
    }
  });
  it('resolves system to high contrast when the device asks for more contrast, light or dark',()=>{
    expect(resolveTheme('system',true,true)).toBe('contrast');
    expect(resolveTheme('system',false,true)).toBe('contrast');
  });
});
