# Theo Ai Take-Home Challenges

## Table of Contents

* [General Instructions](#general-instructions)
* [General Evaluation Criteria](#general-evaluation-criteria)
  * [Evaluation Questions](#evaluation-questions)
* [Challenge 1: Artworks App](#challenge-1-artworks-app)
* [Challenge 2: Document AI Pipeline](#challenge-2-document-ai-pipeline)
* [Challenge 3: Modernize a Legacy Codebase](#challenge-3-modernize-a-legacy-codebase)
* [Suggestions](#suggestions)

## General Instructions

1. Read all the requirements
2. Choose one challenge from the list of challenges below
3. Once you have chosen, fork this repository and create a new branch
   for your solution
4. Once you have completed the challenge, create a pull request
   against this repo's main branch and send an email to
   [tiago@theoai.ai](mailto:tiago@theoai.ai)
5. Your solution's documentation (README, comments, commit messages,
   etc) should answer the questions in the evaluation criteria

See [Suggestions](#suggestions) on how to manage your time
allocation. The submission of your solution is expected within 96
hours (4 days) of having received access to this repo.

---

## General Evaluation Criteria

- **Code Quality**: The code should be clean, readable, and maintainable.
- **Functionality**: The solution should work as expected and meet the
  specifications
- **Performance**: The solution should be performant and efficient
- **Testing**: The solution should be tested and have a good test coverage
- **Documentation**: The solution should be well documented and easy to
  understand
- **Code Structure**: The solution should be well structured and follow best
  practices
- **Error Handling**: The solution should handle errors gracefully and provide
  meaningful error messages
- **Git Hygiene**: The solution should be committed, pushed, and commit history
  should be clean and descriptive

### Evaluation Questions

1. Why did you choose this particular challenge?
2. How long did it take you to complete the challenge?
3. What was the hardest part of the challenge and how did you tackle it?
4. Where did you have the most fun and why?
5. What would you have done if you had more time?

---

## Challenge 1: Artworks App

Your challenge is to build a website that uses the [Metropolitan Museum's
API](https://metmuseum.github.io/).

You bought a Raspberry Pi attached to a portable 7" screen and with WiFi
capabilities. You want to use it to show artwork in your house.

Using TypeScript and React create an interactive website that displays artwork
that you pull from the Metropolitan Museum's API.

### Specifications

- The website should change artworks every 10 seconds
- The artwork should take the whole viewport (scaled proportionaly)
- When tapping on an artwork, display additional information about the artwork
- When displaying the art information, the timer should stop

### Location

This challenge is located in the `artworks-app` folder.

### Choose this challenge if

- You are willing to showcase your frontend, React and TypeScript skills
- You like exploring APIs and work with particular integrations

---

## Challenge 2: Document AI Pipeline

Your challenge is to create a document processing pipeline using AI.

Using TypeScript you need to create a CLI that takes a scientific
document as input and returns a series of datapoints about it (see
specs below).

### Specifications

- Your solution needs to be triggered from the command line and take a
  single scientific paper as input
- Using any AI and data services you find relevant, create a pipeline
  that returns the following fields for the given document:
  - Document type
  - Document author(s)
  - Document date
  - Brief summary about the document's content
  - Brief summary of research methods utilized
  - Brief summary of findings and conclusions

### Location

This challenge is located in the `doc-pipeline` folder. In there, you
will find a folder with some documents to use as reference.

## Choose this challenge if

- You are willing to showcase your AI, agentic and data skills
- You like exploring how AIs work over complex documents

---

## Challenge 3: Modernize a Legacy Codebase

Your challenge is to modernize the Typescript implementation of the [Make a Lisp
(MAL)](https://github.com/kanaka/mal) project.

You have been asked to make sure that your improved implementation runs on Bun
and Deno in addition to Node.

### Specifications

- All dependencies need to be updated to their latest versions (including Node)
- The following modernizations are required. Show your work:
  - Replace manual type checking with TypeScript discriminated unions
  - Use type guards instead of explicit type checks
  - Replace IIFE with direct exports
  - Use optional chaining (?.) where appropriate
  - Use nullish coalescing (??) instead of logical OR
  - Extract repetitive type validations into helper functions
  - Group related functions together
  - Use object destructuring for cleaner function parameters
  - Use array methods (map, reduce, filter) more consistently
  - Simplify conditional logic where possible

### Location

This challenge is located in the `mal` folder. It contains a simplified copy of
the original `Make a Lisp` project for you to work on.

## Choose this challenge if

- You are willing to showcase your ability to dive into a big codebase
- You like exploring meta-problems such as language design

---

## Suggestions

- **Timebox your work**: simply add to your documentation how much time you have
  invested and we will take that into account (solutions usually range from 30
  minutes to 3 hours)
- **The journey matters**: we are interested in your journey to the solution as
  much - if not more than - the solution itself. Make sure to capture the it in
  your final documentation
- **Have fun**: if the challenge ceases to be fun, write how you feel and why as
  part of your documentation and submit it
