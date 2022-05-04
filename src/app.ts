// Drag & Drop Interfaces
interface Draggable {
  dragStartHandler(event: DragEvent): void
  dragEndHandler(event: DragEvent): void
}

interface DragTarget {
  dragOverHandler(event: DragEvent): void
  dropHandler(event: DragEvent): void
  dragLeaveHandler(event: DragEvent): void
}

enum TaskStatus {
  Active,
  Finished,
}

class Task {
  constructor(public id: string, public title: string, public details: string, public status: TaskStatus) {}
}

// Task State Management
type Listener<T> = (items: T[]) => void

class State<T> {
  protected listeners: Listener<T>[] = []

  addListener(listenerFn: Listener<T>) {
    this.listeners.push(listenerFn)
  }
}

class TaskState extends State<Task> {
  private tasks: Task[] = []
  private static instance: TaskState

  private constructor() {
    super()
  }

  static getInstance() {
    if (this.instance) {
      return this.instance
    }
    this.instance = new TaskState()
    return this.instance
  }

  addTask(title: string, details: string) {
    const newTask = new Task(Math.random().toString(), title, details, TaskStatus.Active)
    this.tasks.push(newTask)
    this.updateListeners()
  }

  moveTask(taskId: string, newStatus: TaskStatus) {
    const task = this.tasks.find((task) => task.id === taskId)
    if (task && task.status !== newStatus) {
      task.status = newStatus
      this.updateListeners()
    }
  }

  private updateListeners() {
    for (const listenerFn of this.listeners) {
      listenerFn(this.tasks.slice())
    }
  }
}

const taskState = TaskState.getInstance()

// Validation
interface Validatable {
  value: string | number
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
}

function validate(validatableInput: Validatable) {
  let isValid = true
  if (validatableInput.required) {
    isValid = isValid && validatableInput.value.toString().trim().length !== 0
  }
  if (validatableInput.minLength != null && typeof validatableInput.value === 'string') {
    isValid = isValid && validatableInput.value.length >= validatableInput.minLength
  }
  if (validatableInput.maxLength != null && typeof validatableInput.value === 'string') {
    isValid = isValid && validatableInput.value.length <= validatableInput.maxLength
  }
  if (validatableInput.min != null && typeof validatableInput.value === 'number') {
    isValid = isValid && validatableInput.value >= validatableInput.min
  }
  if (validatableInput.max != null && typeof validatableInput.value === 'number') {
    isValid = isValid && validatableInput.value <= validatableInput.max
  }
  return isValid
}

// autobind decorator
function autobind(_: any, _2: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value
  const adjDescriptor: PropertyDescriptor = {
    configurable: true,
    get() {
      const boundFn = originalMethod.bind(this)
      return boundFn
    },
  }
  return adjDescriptor
}

// Component Base Class
abstract class Component<T extends HTMLElement, U extends HTMLElement> {
  templateElement: HTMLTemplateElement
  hostElement: T
  element: U

  constructor(templateId: string, hostElementId: string, insertAtStart: boolean, newElementId?: string) {
    this.templateElement = document.getElementById(templateId)! as HTMLTemplateElement
    this.hostElement = document.getElementById(hostElementId)! as T

    const importedNode = document.importNode(this.templateElement.content, true)
    this.element = importedNode.firstElementChild as U
    if (newElementId) {
      this.element.id = newElementId
    }

    this.attach(insertAtStart)
  }

  private attach(insertAtBeginning: boolean) {
    this.hostElement.insertAdjacentElement(insertAtBeginning ? 'afterbegin' : 'beforeend', this.element)
  }

  abstract configure(): void
  abstract renderContent(): void
}

// TaskItem Class
class TaskItem extends Component<HTMLUListElement, HTMLLIElement> implements Draggable {
  private task: Task

  constructor(hostId: string, task: Task) {
    super('single-task', hostId, false, task.id)
    this.task = task

    this.configure()
    this.renderContent()
  }

  @autobind
  dragStartHandler(event: DragEvent) {
    event.dataTransfer!.setData('text/plain', this.task.id)
    event.dataTransfer!.effectAllowed = 'move'
  }

  dragEndHandler(_: DragEvent) {
    console.log('DragEnd')
  }

  configure() {
    this.element.addEventListener('dragstart', this.dragStartHandler)
    this.element.addEventListener('dragend', this.dragEndHandler)
  }

  renderContent() {
    this.element.querySelector('h2')!.textContent = this.task.title
    this.element.querySelector('p')!.textContent = this.task.details
  }
}

// TaskList Class
class TaskList extends Component<HTMLDivElement, HTMLElement> implements DragTarget {
  assignedTasks: Task[]

  constructor(private type: 'active' | 'finished') {
    super('task-list', 'app', false, `${type}-tasks`)
    this.assignedTasks = []

    this.configure()
    this.renderContent()
  }

  @autobind
  dragOverHandler(event: DragEvent) {
    if (event.dataTransfer && event.dataTransfer.types[0] === 'text/plain') {
      event.preventDefault()
      const listEl = this.element.querySelector('ul')!
      listEl.classList.add('droppable')
    }
  }

  @autobind
  dropHandler(event: DragEvent) {
    const taskId = event.dataTransfer!.getData('text/plain')
    taskState.moveTask(taskId, this.type === 'active' ? TaskStatus.Active : TaskStatus.Finished)
  }

  @autobind
  dragLeaveHandler(_: DragEvent) {
    const listEl = this.element.querySelector('ul')!
    listEl.classList.remove('droppable')
  }

  configure() {
    this.element.addEventListener('dragover', this.dragOverHandler)
    this.element.addEventListener('dragleave', this.dragLeaveHandler)
    this.element.addEventListener('drop', this.dropHandler)

    taskState.addListener((tasks: Task[]) => {
      const relevantTasks = tasks.filter((task) => {
        if (this.type === 'active') {
          return task.status === TaskStatus.Active
        }
        return task.status === TaskStatus.Finished
      })
      this.assignedTasks = relevantTasks
      this.renderTasks()
    })
  }

  renderContent() {
    const listId = `${this.type}-tasks-list`
    this.element.querySelector('ul')!.id = listId
    this.element.querySelector('h2')!.textContent = this.type.toUpperCase() + ' TASKS'
  }

  private renderTasks() {
    const listEl = document.getElementById(`${this.type}-tasks-list`)! as HTMLUListElement
    listEl.innerHTML = ''
    for (const taskItem of this.assignedTasks) {
      new TaskItem(this.element.querySelector('ul')!.id, taskItem)
    }
  }
}

// TaskInput Class
class TaskInput extends Component<HTMLDivElement, HTMLFormElement> {
  titleInputElement: HTMLInputElement
  detailsInputElement: HTMLInputElement

  constructor() {
    super('task-input', 'app', true)
    this.titleInputElement = this.element.querySelector('#title') as HTMLInputElement
    this.detailsInputElement = this.element.querySelector('#details') as HTMLInputElement
    this.configure()
  }

  configure() {
    this.element.addEventListener('submit', this.submitHandler)
  }

  renderContent() {}

  private gatherUserInput(): [string, string] | void {
    const enteredTitle = this.titleInputElement.value
    const enteredDetails = this.detailsInputElement.value

    const titleValidatable: Validatable = {
      value: enteredTitle,
      required: true,
    }
    const detailsValidatable: Validatable = {
      value: enteredDetails,
      required: false,
    }

    if (!validate(titleValidatable) || !validate(detailsValidatable)) {
      alert('Invalid input, please try again!')
      return
    } else {
      return [enteredTitle, enteredDetails]
    }
  }

  private clearInputs() {
    this.titleInputElement.value = ''
    this.detailsInputElement.value = ''
  }

  @autobind
  private submitHandler(event: Event) {
    event.preventDefault()
    const userInput = this.gatherUserInput()
    if (Array.isArray(userInput)) {
      const [title, details] = userInput
      taskState.addTask(title, details)
      this.clearInputs()
    }
  }
}

const taskInput = new TaskInput()
const activeTaskList = new TaskList('active')
const finishedTaskList = new TaskList('finished')
