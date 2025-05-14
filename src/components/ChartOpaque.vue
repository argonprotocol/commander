<template>
  <div ChartOpaque class="bg-[#E6EAF3] opacity-70"></div>
</template>

<style lang="scss" scoped>
[ChartOpaque] {
  &:before {
    content: '';
    display: block;
    position: absolute;
    bottom: 1px;
    left: 0;
    width: 100%;
    height: 50%;
    background: #F9FAFD;
  }
  &:after {
    content: '';
    display: block;
    position: absolute;
    bottom: calc(25% + 1px);
    left: 0px;
    width: 100%;
    height: 25%;
    background: linear-gradient(to bottom, rgb(230, 234, 243), rgba(230, 234, 243, 0));
    z-index: 1;
  }
}
</style>