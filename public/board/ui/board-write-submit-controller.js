export class BoardWriteSubmitController {
  constructor() {
    this.handler = null;
  }

  setHandler(handler) {
    this.handler = typeof handler === 'function' ? handler : null;
  }

  bind(form, getValues) {
    if (!form) return;
    form.onsubmit = (event) => {
      event.preventDefault();
      if (this.handler) this.handler(getValues());
    };
  }
}
