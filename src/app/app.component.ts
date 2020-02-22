import { Component } from '@angular/core';
import {example} from './stitch';

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.css' ]
})
export class AppComponent  {
  name = 'Angular';

  ngOnInit() {
    console.log(example);
    const obs = example.run();
    obs.subscribe(value => {
      console.log(`Got value: ${JSON.stringify(value)}`);
    });
  }
}
