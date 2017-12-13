import { suite, test, slow, timeout } from 'mocha-typescript';
import { must } from 'must';
import * as UUID from 'uuid';

import { CQRS } from '../../src/cqrs/CQRS';
import { Auth } from '../../src/auth/Auth';
import { InMemoryAggregateEventStore } from '../../src/cqrs/event/store/InMemoryAggregateEventStore';
import { CreateTodoCommand, TodoAggregate, CreateTodoCommandExecutor, MarkTodoDoneCommandExecutor, TodoCreatedEventExecutor, TodoMarkedDoneEventExecutor } from './TodoExample';

const eventExecutors = [new TodoCreatedEventExecutor(), new TodoMarkedDoneEventExecutor()];

const eventStore = new InMemoryAggregateEventStore(eventExecutors);
const cqrs = new CQRS(eventStore);
cqrs.registerCommandExecutor(new CreateTodoCommandExecutor());
cqrs.registerCommandExecutor(new MarkTodoDoneCommandExecutor());
cqrs.registerAggregateClass('Todo', TodoAggregate);
eventExecutors.forEach((ee) => cqrs.registerEventExecutor(ee));
const issuerAuth = new Auth('user', 'userId1', ['registered']);

suite('cqrs', () => {
  suite('Can execute command', () => {
    test('Creates a Todo when the command is executed', async () => {
      const aggregateId = UUID.v4();
      await cqrs.executeCommand(CQRS.deserialiseCommand({ aggregateId, issuerAuth, title: 'Test title', description: 'Test description' },
        'CreateTodoCommand'));
      const aggregate: TodoAggregate = await cqrs.getAggregate(aggregateId) as TodoAggregate;
      aggregate.must.be.an.instanceOf(TodoAggregate);
      aggregate.title.must.equal('Test title');
      aggregate.description.must.equal('Test description');
      aggregate.status.must.equal('NotDone');
    });
    test('Validates the command on execution', async () => {
      const aggregateId = UUID.v4();
      try {
        await cqrs.executeCommand(CQRS.deserialiseCommand({ aggregateId, issuerAuth, title: 'Test title' }, 'CreateTodoCommand'));
        true.must.be.falsy();
      } catch (e) {
        e.must.be.an.error(/^There was an error executing command/);
        e.cause.must.be.an.error('Need to specify a description for the Todo');
      }
    });
    test('Can be marked as done', async () => {
      const aggregateId = UUID.v4();
      const executionContext = cqrs.newExecutionContext();
      await executionContext.addCommandToExecute(CQRS.deserialiseCommand<CreateTodoCommand>({
        aggregateId,
        issuerAuth,
        title: 'Test title',
        description: 'Test description' }, 'CreateTodoCommand'));
      executionContext.addCommandToExecute(CQRS.deserialiseCommand({ aggregateId, issuerAuth }, 'MarkTodoDoneCommand'));
      await executionContext.commit();
      const aggregate = await cqrs.getAggregate(aggregateId) as TodoAggregate;
      aggregate.title.must.equal('Test title');
      aggregate.description.must.equal('Test description');
      aggregate.status.must.equal('Done');
    });
    test('Aggregates survive execution contexts', async () => {
      const aggregateId = UUID.v4();
      const executionContext = cqrs.newExecutionContext();
      executionContext.addCommandToExecute(CQRS.deserialiseCommand({
        aggregateId,
        title: 'Test title',
        issuerAuth,
        description: 'Test description',
      }, 'CreateTodoCommand'));
      await executionContext.commit();
      const aggregate = await cqrs.getAggregate(aggregateId) as TodoAggregate;
      aggregate.title.must.equal('Test title');
      aggregate.description.must.equal('Test description');
      aggregate.status.must.equal('NotDone');
      const executionContext2 = cqrs.newExecutionContext();
      executionContext2.addCommandToExecute(CQRS.deserialiseCommand({ aggregateId, issuerAuth }, 'MarkTodoDoneCommand'));
      await executionContext2.commit();
      const aggregate2 = await cqrs.getAggregate(aggregateId) as TodoAggregate;
      aggregate2.title.must.equal('Test title');
      aggregate2.description.must.equal('Test description');
      aggregate2.status.must.equal('Done');
    });
    test('Only the creator can mark the TODO as done', async () => {
      const aggregateId = UUID.v4();
      const executionContext = cqrs.newExecutionContext();
      executionContext.addCommandToExecute(CQRS.deserialiseCommand({
        aggregateId,
        title: 'Test title',
        issuerAuth,
        description: 'Test description',
      }, 'CreateTodoCommand'));
      await executionContext.commit();

      const issuerAuth2 = new Auth('user', 'other', ['registered']);

      const executionContext2 = cqrs.newExecutionContext();
      executionContext2.addCommandToExecute(CQRS.deserialiseCommand({ aggregateId, issuerAuth: issuerAuth2 }, 'MarkTodoDoneCommand'));
      try {
        await executionContext2.commit();
        true.must.be.falsy();
      } catch (e) {
        e.must.be.an.error(/^There was an error executing command/);
        e.cause.must.be.an.error('Only the creator of the Todo can mark it as done');
      }
    });
  });
});
