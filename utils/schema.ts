import { compileSchema, parseSchema } from 'kiwi-schema';

export const schema = compileSchema(parseSchema(`
enum Action {
  up = 0;
  left = 1;
  right = 2;
  down = 3;
}

struct Actions {
  float x;
  float y;
  float dy;
  Action[] actions;
  bool isGrounded;
  bool isDead;
}

message Example {
  Actions actions = 1;
  uint index = 2;
}
`));
