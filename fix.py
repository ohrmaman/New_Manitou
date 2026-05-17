import sys

file_path = '/Users/ormaman/New_Manitou/script.js'

with open(file_path, 'r') as file:
    content = file.read()

content = content.replace('\\`', '`')
content = content.replace('\\${', '${')

with open(file_path, 'w') as file:
    file.write(content)

print("Fixed syntax errors in script.js")
