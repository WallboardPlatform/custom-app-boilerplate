# Development Workflow

## Development Process

### 1. Discovery Phase
**Before implementing ANY feature**:
- Navigate to `src/`
- Study existing components, services, hooks, contexts, stores and interfaces in relevant directories
- Read the provided documentation in the `docs/` folder

### 2. Thinking Phase
**After reading all the relevant files**:
- Think of a way to retain the existing patterns
- Retain the gained knowledge of the project
- Think of the easiest and most efficient way to implement the request

### 3. Implementation Phase
**Import management**:
- Check existing files for import patterns
- Copy import sections from similar files in the same module
- Fix missing imports based on compiler errors
- Remove unused imports during final review

### 4. Quality Check Phase
**Code Quality Standards**:
- Follow existing SolidJS patterns and conventions
- Use TypeScript for all new code (avoid plain JavaScript)
- Follow the given code styling guideline
- Implement proper error handling and logging
- Ensure responsive design works across devices and on legacy chrome versions
- Follow existing naming conventions and file organization

#### Quality Check Checklist
- [ ] TypeScript compiles without errors
- [ ] No ESLint warnings

### 5. Build Phase
**Decide how to Build the project**:
- If there has been a change to the `src/editor-assets/properties.json` file, 
then build the project with the `build:development:zip` tool
- If there have been only minor changes and the `src/editor-assets/properties.json` file was not modified, 
then build the project with the `build:development` tool

#### Why the use of zip build
The Wallboard ecosystem reads the `properties.json` as the basis, on what the custom app looks like,
what it does, which the base build doesn't include in the output.
The zip build contains the newest version of the JSON, so it's important on every change to it, 
to build a zip of the custom app.

#### What happens after build
The provided build tools handle every deployment specific problems, so there is no need to think of this step.